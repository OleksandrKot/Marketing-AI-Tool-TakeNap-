import { createClient } from '@supabase/supabase-js';

// Try to load dotenv if available (safe dynamic import)
try {
  const mod = await import('dotenv');
  const dot = mod.default ?? mod;
  dot.config({ path: '../.env.local' });
} catch (e) {
  console.warn('dotenv not available — skipping .env loading');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET_PHOTO = process.env.NEXT_PUBLIC_AD_BUCKET_PHOTO;
const BUCKET_VIDEO = process.env.NEXT_PUBLIC_AD_BUCKET_VIDEO_PREVIEW;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  process.exit(1);
}

if (!BUCKET_PHOTO || !BUCKET_VIDEO) {
  console.error('NEXT_PUBLIC_AD_BUCKET_PHOTO or NEXT_PUBLIC_AD_BUCKET_VIDEO_PREVIEW is missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function streamToBuffer(stream) {
  if (!stream) throw new Error('No stream provided');

  if (Buffer.isBuffer(stream)) return stream;

  if (typeof stream.arrayBuffer === 'function') {
    const ab = await stream.arrayBuffer();
    return Buffer.from(ab);
  }

  if (stream.readable === true || typeof stream.on === 'function') {
    return await new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }

  const reader = stream?.getReader?.() ?? stream?.body?.getReader?.();

  if (reader && typeof reader.read === 'function') {
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  throw new Error('stream is not a supported stream/readable type');
}

async function downloadPrivate(bucket, filePath) {
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error || !data) return null;
  return await streamToBuffer(data);
}

async function calcPHashFromBuffer(buffer) {
  const sharpMod = (await import('sharp')).default ?? (await import('sharp'));

  const img = sharpMod(buffer).resize(8, 8, { fit: 'fill' }).removeAlpha().grayscale();

  const { data } = await img.raw().toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / data.length;

  let bits = '';
  for (let i = 0; i < data.length; i++) {
    bits += data[i] > avg ? '1' : '0';
  }

  const hex = BigInt('0b' + bits)
    .toString(16)
    .padStart(bits.length / 4, '0');
  return hex;
}

async function processRow(ad) {
  const { id, ad_archive_id: adId } = ad;

  if (!adId) {
    console.warn(`⚠️ Row ${id} has no ad_archive_id`);
    return;
  }

  const photoPath = `${adId}.jpeg`;
  const previewPath = `${adId}.jpeg`;

  let buffer = null;
  let usedFile = null;

  buffer = await downloadPrivate(BUCKET_PHOTO, photoPath);
  if (buffer) {
    usedFile = `photo:${BUCKET_PHOTO}/${photoPath}`;
  } else {
    buffer = await downloadPrivate(BUCKET_VIDEO, previewPath);
    if (buffer) {
      usedFile = `preview:${BUCKET_VIDEO}/${previewPath}`;
    }
  }

  if (!buffer) {
    console.warn(`⚠️ Row ${id}: No media file found for ad_archive_id=${adId}`);
    return;
  }

  let pHash;
  try {
    pHash = await calcPHashFromBuffer(buffer);
  } catch (err) {
    console.error(`❌ Row ${id}: pHash failed`, err?.message ?? err);
    return;
  }

  try {
    const { error } = await supabase
      .from('ads_library')
      .update({ creative_hash: pHash })
      .eq('id', id);

    if (error) {
      console.error(`Row ${id}: failed to update creative_hash`, error.message);
    } else {
      console.log(`Row ${id}: creative_hash (pHash) = ${pHash} (${usedFile})`);
    }
  } catch (e) {
    console.error(`Row ${id}: unexpected DB error`, e?.message ?? e);
  }
}

async function main() {
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('ads_library')
      .select('id, ad_archive_id')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('❌ SELECT error:', error.message);
      break;
    }

    if (!data || data.length === 0) {
      console.log('🎉 No more rows, done.');
      break;
    }

    console.log(`➡ Processing rows ${offset}..${offset + data.length - 1}`);

    for (const ad of data) {
      await processRow(ad);
    }

    if (data.length < pageSize) {
      console.log('🎉 Last batch processed.');
      break;
    }

    offset += pageSize;
  }
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
