import { getPublicImageUrl } from '@/lib/storage/helpers';

// Ensure this file is always treated as a module by TypeScript (helps in
// some environments where duplicate/old build artifacts cause TS2306).
export {};

type CacheEntry = {
  url: string;
  expiresAt: number; // epoch ms
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

function makeKey(bucket: string, path: string) {
  return `${bucket}/${path}`;
}

export function getCachedSignedUrl(bucket: string, path: string): string | null {
  const k = makeKey(bucket, path);
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() < e.expiresAt) return e.url;
  cache.delete(k);
  return null;
}

/**
 * Get a signed URL for a storage object, with a small in-memory cache.
 * If a previous signed URL is cached and not expired it will be returned.
 * Concurrent requests for the same key are deduped.
 * On failure the public URL (getPublicImageUrl) is returned as a fallback.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expires = 60
): Promise<string | null> {
  const k = makeKey(bucket, path);

  const cached = getCachedSignedUrl(bucket, path);
  if (cached) return cached;

  if (inflight.has(k)) {
    return inflight.get(k)!;
  }

  const p = (async () => {
    try {
      const res = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, path, expires }),
      });

      // If the server returned OK and a url, use it
      if (res.ok) {
        const j = await res.json();
        if (j?.url) {
          // cache for slightly less than expiry to avoid edge cases
          const ttlSeconds = Math.max(5, expires - 5);
          const expiresAt = Date.now() + ttlSeconds * 1000;
          cache.set(k, { url: j.url as string, expiresAt });
          return j.url as string;
        }
      } else {
        // Try to read error body to decide how to behave
        let body: unknown = null;
        try {
          body = await res.json();
        } catch (e) {
          /* ignore JSON parse errors */
        }

        // If Supabase reports the object is not found, return null so callers
        // can fallback to the ad.image_url / previewImage instead of the public storage URL
        let errMsg = '';
        if (body && typeof body === 'object' && body !== null) {
          const b = body as Record<string, unknown>;
          if (typeof b.error === 'string') errMsg = b.error;
          else if (typeof b.message === 'string') errMsg = b.message;
        }
        if (typeof errMsg === 'string' && /no resource with given identifier/i.test(errMsg)) {
          console.warn('[storage-url-cache] object not found in bucket:', {
            bucket,
            path,
            err: errMsg,
          });
          return null;
        }

        // otherwise continue to fallback to public URL below
        console.error('[storage-url-cache] signed-url request failed', {
          status: res.status,
          body,
        });
      }
    } catch (e) {
      // ignore network/other errors and fallback below
      console.error('[storage-url-cache] fetch error for signed url', e);
    }

    // fallback to public URL. Cache for a short time to avoid hammering.
    const pub = getPublicImageUrl(`${bucket}/${path}`);
    cache.set(k, { url: pub, expiresAt: Date.now() + 30 * 1000 });
    return pub;
  })();

  inflight.set(k, p);
  try {
    const result = await p;
    return result;
  } finally {
    inflight.delete(k);
  }
}

// New helper: try multiple extensions server-side in a single request and return
// the first signed URL found (or null). This prevents the client from making
// multiple POSTs when we only need one result per ad.
export async function getSignedUrlForBase(
  bucket: string,
  base: string,
  exts: string[] = ['jpeg', 'jpg', 'png'],
  expires = 60
): Promise<string | null> {
  const k = makeKey(`find:${bucket}`, base);

  const cached = getCachedSignedUrl(bucket, `${base}`);
  if (cached) return cached;

  if (inflight.has(k)) {
    return inflight.get(k)!;
  }

  const p = (async () => {
    try {
      const res = await fetch('/api/storage/signed-url/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, base, exts, expires }),
      });

      if (res.ok) {
        const j = await res.json();
        if (j?.url) {
          const ttlSeconds = Math.max(5, expires - 5);
          const expiresAt = Date.now() + ttlSeconds * 1000;
          // cache under the exact tried path so subsequent lookups by path work
          cache.set(makeKey(bucket, j.path), { url: j.url as string, expiresAt });
          return j.url as string;
        }
        // url null means not found
        return null;
      }
    } catch (e) {
      console.error('[storage-url-cache] getSignedUrlForBase fetch error', e);
    }

    return null;
  })();

  inflight.set(k, p);
  try {
    const result = await p;
    return result;
  } finally {
    inflight.delete(k);
  }
}
