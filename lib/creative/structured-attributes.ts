export type PropItem = { key: string; label: string; value: string };

export function prettifyKey(k: string) {
  if (!k) return '';
  const parts = k
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1));
  return parts.join(' ');
}

export const toKeyString = (label: string) =>
  label
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map((w, idx) => (idx === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join('');

export const stringifyValue = (v: unknown) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return (v as unknown[]).map(stringifyValue).filter(Boolean).join(', ');
  try {
    return JSON.stringify(v);
  } catch (e) {
    return String(v);
  }
};

export const tryParseJson = (text: string): unknown | null => {
  if (!text) return null;
  let candidate = String(text).trim();

  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) candidate = fence[1].trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        /* ignore */
      }
    }
    const arrMatch = candidate.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
};

export const flattenJsonToProps = (target: PropItem[], val: unknown, prefix: string) => {
  if (val === null || val === undefined) return;

  const pushPrimitive = (value: unknown, key: string) => {
    const v = stringifyValue(value);
    if (!v) return;
    target.push({ key, label: prettifyKey(key), value: v });
  };

  // If this is a string, try to detect an embedded JSON payload and parse it.
  if (typeof val === 'string') {
    const parsed = tryParseJson(val);
    if (parsed !== null) {
      // If parsed, recurse into the parsed value using the same prefix
      flattenJsonToProps(target, parsed, prefix);
      return;
    }
    pushPrimitive(val, prefix);
    return;
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    pushPrimitive(val, prefix);
    return;
  }

  if (Array.isArray(val)) {
    const arr = val as unknown[];
    // For each item, if it's a string that contains JSON, try to parse it first
    arr.forEach((item, idx) => {
      let itemToUse = item;
      if (typeof item === 'string') {
        const p = tryParseJson(item);
        if (p !== null) itemToUse = p;
      }
      // Recurse for each array item using a bracketed index in the prefix
      flattenJsonToProps(target, itemToUse, `${prefix}[${idx}]`);
    });
    return;
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      const childPrefix = prefix ? `${prefix}.${k}` : k;
      // If a nested value is a string containing JSON, it'll be handled by the
      // string branch above when recursion hits it, so just recurse normally.
      flattenJsonToProps(target, v, childPrefix);
    }
  }
};

export function extractVisualElementsFromText(text?: string) {
  const out: string[] = [];
  if (!text) return out;
  const lines = String(text).split(/\r?\n/);
  const timeRe = /^(?:\s*\d{1,2}[:.]\d{2}\s*(?:[-–—]\s*\d{1,2}[:.]\d{2})?[:\s-]*)+(.*)$/;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(timeRe);
    const candidate = m && m[1] ? m[1].trim() : line;
    if (
      candidate.length > 6 &&
      !/^(visual description|visual elements|scene|scenes)/i.test(candidate)
    ) {
      out.push(candidate.replace(/^[-•\s]+/, '').trim());
    }
  }
  if (!out.length) {
    const paras = String(text)
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const p of paras) {
      if (p.length > 20) out.push(p.replace(/^[-•\s]+/, '').trim());
    }
  }
  return out;
}

export default {
  prettifyKey,
  toKeyString,
  stringifyValue,
  tryParseJson,
  flattenJsonToProps,
  extractVisualElementsFromText,
};
