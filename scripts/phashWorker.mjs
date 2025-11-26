import { createClient } from '@supabase/supabase-js';

// Safe dotenv (optional)
try {
  const mod = await import('dotenv');
  const dot = mod.default ?? mod;
  dot.config({ path: '../.env.local' });
} catch (e) {
  // ignore
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_PHOTO = process.env.NEXT_PUBLIC_AD_BUCKET_PHOTO;
const BUCKET_VIDEO = process.env.NEXT_PUBLIC_AD_BUCKET_VIDEO_PREVIEW;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

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
  throw new Error('Unsupported stream type');
}

async function downloadFromStorage(bucket, filepath) {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(filepath);
    if (error || !data) return null;
    return await streamToBuffer(data);
  } catch (e) {
    return null;
  }
}

async function fetchUrlToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch failed ' + res.status);
  return await streamToBuffer(res.body ?? res);
}

// Compute 8x8 average hash (aHash) — matches recalcCreativeHash.mjs
async function calcPHashFromBuffer(buffer) {
  const sharpMod = (await import('sharp')).default ?? (await import('sharp'));
  const img = sharpMod(buffer).resize(8, 8, { fit: 'fill' }).removeAlpha().grayscale();
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / data.length;

  let bits = '';
  for (let i = 0; i < data.length; i++) bits += data[i] > avg ? '1' : '0';

  const hex = BigInt('0b' + bits)
    .toString(16)
    .padStart(bits.length / 4, '0');
  return hex;
}

async function processNewRow(row) {
  const id = row.id;
  const adId = row.ad_archive_id;
  if (!adId) return;
  if (row.creative_hash) return; // already present

  console.log('phash-worker: processing id=', id, 'ad_archive_id=', adId);

  const exts = ['jpeg', 'jpg', 'png', 'webp'];
  let buffer = null;
  let used = null;

  if (BUCKET_PHOTO) {
    for (const ext of exts) {
      const p = `${adId}.${ext}`;
      buffer = await downloadFromStorage(BUCKET_PHOTO, p);
      if (buffer) {
        used = `${BUCKET_PHOTO}/${p}`;
        break;
      }
    }
  }

  if (!buffer && BUCKET_VIDEO) {
    for (const ext of exts) {
      const p = `${adId}.${ext}`;
      buffer = await downloadFromStorage(BUCKET_VIDEO, p);
      if (buffer) {
        used = `${BUCKET_VIDEO}/${p}`;
        break;
      }
    }
  }

  if (!buffer && SUPABASE_URL && BUCKET_PHOTO) {
    try {
      const publicUrl = `${SUPABASE_URL.replace(
        /\/$/,
        ''
      )}/storage/v1/object/public/${BUCKET_PHOTO}/${adId}.jpeg`;
      buffer = await fetchUrlToBuffer(publicUrl);
      if (buffer) used = publicUrl;
    } catch (e) {
      // ignore
    }
  }

  if (!buffer) {
    console.warn('phash-worker: no media found for', adId);
    return;
  }

  try {
    const ph = await calcPHashFromBuffer(buffer);
    if (!ph) {
      console.warn('phash-worker: phash empty for', id);
      return;
    }
    const { error } = await supabase.from('ads_library').update({ creative_hash: ph }).eq('id', id);
    if (error) console.error('phash-worker: failed update', error.message);
    else console.log(`phash-worker: updated ${id} -> ${ph} (used ${used})`);
  } catch (e) {
    console.error('phash-worker: processing failed', e?.message ?? e);
  }
}

async function catchupProcess() {
  console.log('phash-worker: catchup - scanning for rows without creative_hash');
  const { data, error } = await supabase
    .from('ads_library')
    .select('id, ad_archive_id, creative_hash')
    .is('creative_hash', null)
    .limit(200);
  if (error) return console.error('phash-worker: catchup query failed', error.message);
  for (const r of data) {
    await processNewRow(r);
  }
}

async function main() {
  await catchupProcess();

  console.log('phash-worker: subscribing to INSERT events on ads_library');
  const sub = supabase
    .channel('phash-worker')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ads_library' },
      (payload) => {
        const newRow = payload?.new;
        if (newRow)
          processNewRow(newRow).catch((e) => console.error('phash-worker handler error', e));
      }
    )
    .subscribe();

  sub.subscribe((_status) => {
    // noop — handled in logs
  });
}

main().catch((e) => {
  console.error('phash-worker: fatal', e?.message ?? e);
  process.exit(1);
});
