import type { Ad } from '@/lib/core/types';

export const getImageKey = (imageUrl: string): string => {
  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split('/');
    const basePath = parts.slice(0, -1).join('/');
    return `${url.hostname}${basePath}`;
  } catch {
    return imageUrl.split('?')[0].split('/').slice(0, -1).join('/');
  }
};

export const getGroupingKey = (ad: Ad): string => {
  // Prefer explicit perceptual hash when available — this groups visually similar
  // creatives together regardless of minor URL or text differences.
  // prefer explicit perceptual hash fields if present
  const rad = ad as unknown as Record<string, unknown>;
  const phash = (rad['creative_phash'] ?? rad['creative_hash'] ?? null) as unknown;
  if (phash && String(phash).trim() !== '') return `phash:${String(phash).trim()}`;

  const imageKey = ad.image_url ? getImageKey(ad.image_url) : 'no-image';
  const rawText = ad.text || ad.title || '';
  const textKey = rawText ? rawText.substring(0, 100).replace(/\s+/g, ' ').trim() : 'no-text';
  return `${imageKey}|${textKey}`;
};

export const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

export const uniqueTags = (ads: Ad[]): string[] =>
  Array.from(
    new Set(
      ads
        .filter((ad) => Array.isArray(ad.tags) && ad.tags.length > 0)
        .flatMap((ad) => ad.tags || [])
    )
  ).sort();

// --- pHash helpers ---
// Normalize a hex hash string: remove 0x, lowercase, trim
export const normalizeHex = (h?: string | null): string | null => {
  if (!h || typeof h !== 'string') return null;
  let s = h.trim();
  if (s.startsWith('0x') || s.startsWith('0X')) s = s.slice(2);
  s = s.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (s.length === 0) return null;
  return s;
};

// Convert hex string to binary bit array (array of 0/1). If lengths differ, pad left with zeros.
export const hexToBitArray = (hex: string, targetBits?: number): number[] => {
  const n = normalizeHex(hex) || '';
  const bits: number[] = [];
  for (let i = 0; i < n.length; i++) {
    const byte = parseInt(n[i], 16);
    for (let b = 3; b >= 0; b--) bits.push((byte >> b) & 1);
  }
  if (typeof targetBits === 'number' && bits.length < targetBits) {
    const pad = new Array(targetBits - bits.length).fill(0);
    return pad.concat(bits);
  }
  return bits;
};

export const hammingDistanceHex = (a?: string | null, b?: string | null): number => {
  const na = normalizeHex(a) || '';
  const nb = normalizeHex(b) || '';
  if (na.length === 0 || nb.length === 0) return Infinity;
  const bitsA = hexToBitArray(na);
  const bitsB = hexToBitArray(nb, bitsA.length);
  let diff = 0;
  for (let i = 0; i < bitsA.length; i++) if ((bitsA[i] || 0) !== (bitsB[i] || 0)) diff++;
  return diff;
};

// Build phash clusters (connected components) from an array of phash keys
// phashKeys: array of keys like 'phash:abcd...'
// groupMap: map from key -> Ad[] (used to compute representative sizes)
// threshold: hamming distance threshold
export function buildPhashClustersFromKeys(
  phashKeys: string[],
  groupMap: Map<string, Ad[]>,
  threshold: number
) {
  const keyIndex = new Map<string, number>();
  phashKeys.forEach((k, i) => keyIndex.set(k, i));
  const n = phashKeys.length;
  const parent = new Array<number>(n).fill(0).map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    const ki = phashKeys[i];
    const hexA = ki.slice(6);
    for (let j = i + 1; j < n; j++) {
      const kj = phashKeys[j];
      const hexB = kj.slice(6);
      const dist = hammingDistanceHex(hexA, hexB);
      if (Number.isFinite(dist) && dist <= threshold) union(i, j);
    }
  }

  const compMap = new Map<number, string[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = compMap.get(r) ?? [];
    arr.push(phashKeys[i]);
    compMap.set(r, arr);
  }

  const phashClusters = new Map<string, string[]>();
  for (const keys of compMap.values()) phashClusters.set(keys[0], keys);

  const keyToRep = new Map<string, string>();
  for (const [rep, keys] of phashClusters.entries()) for (const k of keys) keyToRep.set(k, rep);

  const repSize = new Map<string, number>();
  for (const [rep, keys] of phashClusters.entries()) {
    let s = 0;
    for (const kk of keys) s += groupMap.get(kk)?.length ?? 0;
    repSize.set(rep, s);
  }

  return { phashClusters, keyToRep, repSize } as const;
}

export function extractDataArray(raw: unknown): Ad[] {
  if (Array.isArray(raw)) return raw as Ad[];
  if (raw && typeof raw === 'object' && raw !== null && 'data' in raw) {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data as Ad[];
  }
  return [];
}

export function getRowFromPayload(p: unknown): Record<string, unknown> | null {
  if (!p || typeof p !== 'object') return null;
  const obj = p as Record<string, unknown>;
  if ('record' in obj && obj.record && typeof obj.record === 'object')
    return obj.record as Record<string, unknown>;
  if ('new' in obj && obj.new && typeof obj.new === 'object')
    return obj.new as Record<string, unknown>;
  return obj;
}
