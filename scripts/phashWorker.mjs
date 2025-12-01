import { createClient } from '@supabase/supabase-js';

// Safe dotenv (optional, for local CLI)
try {
  const mod = await import('dotenv');
  const dot = mod.default ?? mod;
  dot.config({ path: '../.env.local' });
} catch (e) {
  // ignore if dotenv not available or file missing
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_PHOTO = process.env.NEXT_PUBLIC_AD_BUCKET_PHOTO;
const BUCKET_VIDEO = process.env.NEXT_PUBLIC_AD_BUCKET_VIDEO_PREVIEW;

// --- Initial env logging (without leaking secrets) ---
console.log('phash-worker: env configuration', {
  SUPABASE_URL: SUPABASE_URL || 'MISSING',
  SUPABASE_KEY_PRESENT: !!SUPABASE_KEY,
  BUCKET_PHOTO: BUCKET_PHOTO || 'MISSING',
  BUCKET_VIDEO: BUCKET_VIDEO || 'MISSING',
});

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('phash-worker: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  // In serverless environments this will just log; CLI will exit below if needed
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

/**
 * Convert various stream-like objects to a Node Buffer.
 */
async function streamToBuffer(stream) {
  if (!stream) throw new Error('No stream');

  if (Buffer.isBuffer(stream)) return stream;

  if (typeof stream.arrayBuffer === 'function') {
    const ab = await stream.arrayBuffer();
    return Buffer.from(ab);
  }

  if (stream.readable === true || typeof stream.on === 'function') {
    return await new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  const reader = stream?.getReader
    ? stream.getReader()
    : stream?.body?.getReader
    ? stream.body.getReader()
    : null;

  if (reader && typeof reader.read === 'function') {
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  throw new Error('Unsupported stream type in streamToBuffer');
}

/**
 * Download a file from a Supabase storage bucket and log all outcomes.
 */
async function downloadFromStorage(bucket, filepath) {
  console.log('phash-worker: attempting storage download', {
    bucket,
    filepath,
  });

  try {
    const { data, error } = await supabase.storage.from(bucket).download(filepath);

    if (error || !data) {
      console.warn('phash-worker: storage download failed', {
        bucket,
        filepath,
        error: error?.message ?? error ?? null,
        hasData: !!data,
      });
      return null;
    }

    console.log('phash-worker: storage download success', {
      bucket,
      filepath,
    });

    return await streamToBuffer(data);
  } catch (e) {
    console.error('phash-worker: storage download threw exception', {
      bucket,
      filepath,
      error: e?.message ?? e,
    });
    return null;
  }
}

/**
 * Download any URL to a Buffer, with logging.
 */
async function fetchUrlToBuffer(url) {
  console.log('phash-worker: attempting fetch from public URL', { url });

  const res = await fetch(url);
  if (!res.ok) {
    console.error('phash-worker: public fetch failed', {
      url,
      status: res.status,
      statusText: res.statusText,
    });
    throw new Error('fetch failed ' + res.status);
  }

  console.log('phash-worker: public fetch ok', {
    url,
    status: res.status,
  });

  return await streamToBuffer(res.body ?? res);
}

// Compute 8x8 average hash (aHash) — matches recalcCreativeHash.mjs
async function calcPHashFromBuffer(buffer) {
  console.log('phash-worker: starting pHash calculation, buffer length=', buffer.length);

  const sharpMod = (await import('sharp')).default ?? (await import('sharp'));
  const img = sharpMod(buffer).resize(8, 8, { fit: 'fill' }).removeAlpha().grayscale();
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });

  console.log('phash-worker: image downscaled to 8x8 grayscale, bytes=', data.length);

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / data.length;

  console.log('phash-worker: grayscale average value', { avg });

  let bits = '';
  for (let i = 0; i < data.length; i++) bits += data[i] > avg ? '1' : '0';

  const hex = BigInt('0b' + bits)
    .toString(16)
    .padStart(bits.length / 4, '0');

  console.log('phash-worker: computed pHash', { hex });

  return hex;
}

/**
 * Process a single row from ads_library: resolve media, compute hash, update DB.
 */
async function processNewRow(row) {
  const id = row.id;
  const adId = row.ad_archive_id;

  console.log('phash-worker: processNewRow start', {
    id,
    adId,
    hasCreativeHashAlready: !!row.creative_hash,
  });

  if (!adId) {
    console.warn('phash-worker: row has no ad_archive_id, skipping', { id });
    return;
  }

  if (row.creative_hash) {
    console.log('phash-worker: creative_hash already set, skipping', {
      id,
      adId,
      creative_hash: row.creative_hash,
    });
    return; // already present
  }

  const exts = ['jpeg', 'jpg', 'png', 'webp'];
  let buffer = null;
  let used = null;

  // Try photo bucket
  if (BUCKET_PHOTO) {
    console.log('phash-worker: trying photo bucket', {
      bucket: BUCKET_PHOTO,
      adId,
      exts,
    });

    for (const ext of exts) {
      const p = `${adId}.${ext}`;
      buffer = await downloadFromStorage(BUCKET_PHOTO, p);
      if (buffer) {
        used = `${BUCKET_PHOTO}/${p}`;
        console.log('phash-worker: media found in photo bucket', {
          id,
          adId,
          path: used,
        });
        break;
      }
    }
  } else {
    console.warn('phash-worker: BUCKET_PHOTO not configured, skipping photo bucket');
  }

  // Try video preview bucket
  if (!buffer && BUCKET_VIDEO) {
    console.log('phash-worker: trying video bucket', {
      bucket: BUCKET_VIDEO,
      adId,
      exts,
    });

    for (const ext of exts) {
      const p = `${adId}.${ext}`;
      buffer = await downloadFromStorage(BUCKET_VIDEO, p);
      if (buffer) {
        used = `${BUCKET_VIDEO}/${p}`;
        console.log('phash-worker: media found in video bucket', {
          id,
          adId,
          path: used,
        });
        break;
      }
    }
  } else if (!buffer && !BUCKET_VIDEO) {
    console.warn('phash-worker: BUCKET_VIDEO not configured, skipping video bucket');
  }

  // Fallback to public URL from photo bucket
  if (!buffer && SUPABASE_URL && BUCKET_PHOTO) {
    try {
      const publicUrl = `${SUPABASE_URL.replace(
        /\/$/,
        ''
      )}/storage/v1/object/public/${BUCKET_PHOTO}/${adId}.jpeg`;

      console.log('phash-worker: trying public URL fallback', {
        id,
        adId,
        url: publicUrl,
      });

      buffer = await fetchUrlToBuffer(publicUrl);
      if (buffer) {
        used = publicUrl;
        console.log('phash-worker: media found via public URL fallback', {
          id,
          adId,
          url: publicUrl,
        });
      }
    } catch (e) {
      console.error('phash-worker: public URL fallback failed', {
        id,
        adId,
        error: e?.message ?? e,
      });
    }
  }

  if (!buffer) {
    console.warn('phash-worker: no media found for ad', { id, adId });
    return;
  }

  try {
    const ph = await calcPHashFromBuffer(buffer);
    if (!ph) {
      console.warn('phash-worker: pHash is empty for row', { id, adId });
      return;
    }

    console.log('phash-worker: updating ads_library with pHash', {
      id,
      adId,
      creative_hash: ph,
    });

    const { error } = await supabase.from('ads_library').update({ creative_hash: ph }).eq('id', id);

    if (error) {
      console.error('phash-worker: failed to update ads_library', {
        id,
        adId,
        error: error.message,
      });
    } else {
      console.log('phash-worker: successfully updated ads_library', {
        id,
        adId,
        creative_hash: ph,
        usedSource: used,
      });
    }
  } catch (e) {
    console.error('phash-worker: processing failed', {
      id,
      adId,
      error: e?.message ?? e,
    });
  }
}

/**
 * Scan ads_library for rows where creative_hash is null and process them.
 */
async function catchupProcess() {
  console.log('phash-worker: catchup - scanning for rows without creative_hash');

  const { data, error } = await supabase
    .from('ads_library')
    .select('id, ad_archive_id, creative_hash')
    .is('creative_hash', null)
    .limit(200);

  if (error) {
    console.error('phash-worker: catchup query failed', {
      error: error.message,
    });
    return;
  }

  if (!data || !data.length) {
    console.log('phash-worker: nothing to process (no rows without creative_hash)');
    return;
  }

  console.log('phash-worker: rows to process count', { count: data.length });

  for (const r of data) {
    await processNewRow(r);
  }

  console.log('phash-worker: catchup finished for current batch');
}

/**
 * One-shot worker entrypoint:
 * - used by serverless cron / API route
 * - only runs catchup once without opening a long-lived realtime subscription
 */
export async function runPhashWorkerOnce() {
  console.log('phash-worker: running single catchup pass (serverless-safe)');
  await catchupProcess();
}

/**
 * Long-lived mode: only when called via `node phashWorker.mjs`
 * This keeps the original behavior with realtime subscription.
 */
async function main() {
  console.log('phash-worker: main() starting (long-lived mode)');
  await catchupProcess();

  console.log('phash-worker: subscribing to INSERT events on ads_library');

  const sub = supabase
    .channel('phash-worker')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ads_library' },
      (payload) => {
        const newRow = payload?.new;
        console.log('phash-worker: realtime INSERT payload received', {
          newRowId: newRow?.id,
          newRowAdId: newRow?.ad_archive_id,
        });

        if (newRow) {
          processNewRow(newRow).catch((e) =>
            console.error('phash-worker: realtime handler error', {
              error: e?.message ?? e,
            })
          );
        }
      }
    )
    .subscribe();

  sub.subscribe((status) => {
    console.log('phash-worker: realtime subscription status changed', { status });
  });
}

// CLI mode: if you run `node phashWorker.mjs`, start long-lived worker.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('phash-worker: fatal', e?.message ?? e);
    process.exit(1);
  });
}
