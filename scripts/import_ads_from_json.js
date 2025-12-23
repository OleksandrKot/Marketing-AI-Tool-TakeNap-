import fs from 'node:fs/promises';
import { statSync, readFileSync } from 'node:fs';
import pLimit from 'p-limit';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/* ================= ENV ================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const INPUT = process.argv[2] || 'ads.json';
const REPORT_PATH = process.env.REPORT_PATH || 'report.csv';

// Concurrency
const CONCURRENCY = Number(process.env.CONCURRENCY || 10); // ads concurrency
const IO_CONCURRENCY = Number(process.env.IO_CONCURRENCY || Math.max(8, CONCURRENCY * 3)); // io concurrency

const IMPORT_JOB_ID = process.env.IMPORT_JOB_ID || process.env.JOB_ID || randomUUID();

// Buckets
const BUCKET_PHOTO = process.env.BUCKET_PHOTO || 'test9bucket_photo';
const BUCKET_VIDEO_PREVIEW = process.env.BUCKET_VIDEO_PREVIEW || 'test10public_preview';
const BUCKET_VIDEO = process.env.BUCKET_VIDEO || 'test8public';

const SKIP_IF_ALREADY_IN_DB = (process.env.SKIP_IF_ALREADY_IN_DB ?? 'true') === 'true';

// Other skips
const SKIP_IF_CARDS_EXIST = (process.env.SKIP_IF_CARDS_EXIST ?? 'true') === 'true';
const SKIP_MAIN_IF_EXISTS = (process.env.SKIP_MAIN_IF_EXISTS ?? 'true') === 'true';
const SKIP_VIDEO_IF_EXISTS = (process.env.SKIP_VIDEO_IF_EXISTS ?? 'true') === 'true';

// Stop signal
let shouldStop = false;
let stopCheckInterval = null;
const STOP_FILE = process.env.STOP_FILE || null;
const JOB_ID = process.env.JOB_ID || null;
const STARTED_AT = Number(process.env.STARTED_AT || Date.now());

// Debug
const DEBUG = (process.env.DEBUG_IMPORT ?? 'false') === 'true';
const debug = (...args) => {
  if (DEBUG) console.log('[import-debug]', ...args);
};

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`Timeout ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function sb(promise, label, ms = 15000) {
  return await withTimeout(promise, ms, `supabase:${label}`);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[import] ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

console.log('[import] Connecting to Supabase...');
console.log('[import] SUPABASE_URL:', SUPABASE_URL?.slice(0, 30) + '...');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
console.log('[import] ✓ Supabase client created');

const limitAds = pLimit(CONCURRENCY);
const limitIo = pLimit(IO_CONCURRENCY);

console.log(
  `[import] start job=${IMPORT_JOB_ID} input=${INPUT} report=${REPORT_PATH} ads_concurrency=${CONCURRENCY} io_concurrency=${IO_CONCURRENCY}`
);

/* ================= STOP ================= */

function setupStopSignal() {
  if (STOP_FILE && JOB_ID) {
    stopCheckInterval = setInterval(() => {
      try {
        const st = statSync(STOP_FILE);
        const content = readFileSync(STOP_FILE, 'utf8').trim();
        if (content === JOB_ID) {
          const isRecent = (st.mtimeMs || st.ctimeMs || 0) >= STARTED_AT;
          if (!shouldStop && isRecent) {
            shouldStop = true;
            console.log('[import] ⛔ STOP SIGNAL RECEIVED');
          }
        }
      } catch {}
    }, 300);
  }
}
function cleanupStopSignal() {
  if (stopCheckInterval) clearInterval(stopCheckInterval);
  stopCheckInterval = null;
}
setupStopSignal();

/* ============ JSON PARSING ============ */

function looksLikeAd(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return typeof obj.ad_archive_id === 'string' || !!obj.snapshot || typeof obj.id === 'string';
}

function extractAdsArray(payload) {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object') {
    const keys = ['data', 'items', 'ads', 'results', 'rows'];
    for (const k of keys) {
      if (Array.isArray(payload[k])) return payload[k];
    }
    if (looksLikeAd(payload)) return [payload];
  }

  throw new Error(
    'Unsupported JSON shape. Need array OR object with data/items/ads/results[] OR single ad object.'
  );
}

function parseNdjson(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  for (const ln of lines) {
    try {
      const o = JSON.parse(ln);
      if (o && typeof o === 'object') out.push(o);
    } catch {}
  }
  return out;
}

async function loadAdsFromFile() {
  console.log(`[import] Reading file: ${INPUT}`);
  const raw = await fs.readFile(INPUT, 'utf8');
  const text = raw.trim();
  if (!text) throw new Error('Input file is empty');

  console.log(`[import] File size: ${text.length} bytes`);

  try {
    console.log(`[import] Parsing JSON...`);
    const payload = JSON.parse(text);
    const arr = extractAdsArray(payload);
    console.log(`[import] ✓ Parsed JSON successfully, found ${arr.length} ads`);
    return arr.filter((x) => x && typeof x === 'object');
  } catch (e) {
    console.log(`[import] JSON parse failed, trying NDJSON...`);
    const nd = parseNdjson(text);
    if (nd.length) {
      console.log(`[import] ✓ Parsed NDJSON successfully, found ${nd.length} ads`);
      return nd;
    }
    console.error(`[import] ❌ Failed to parse file:`, e?.message);
    throw new Error(`Failed to parse JSON/NDJSON: ${e?.message || String(e)}`);
  }
}

/* ============ CSV ============ */

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}
async function appendCsv(line) {
  await fs.appendFile(REPORT_PATH, line + '\n', 'utf8');
}

/* ============ DOWNLOAD/UPLOAD ============ */

function extFromCT(ct = '') {
  ct = ct.toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('mp4')) return 'mp4';
  return 'jpg';
}

async function download(url, timeoutMs = 30000) {
  debug('download:start', url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) throw new Error(`Download failed ${r.status}: ${url}`);
    const buf = await r.arrayBuffer();
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    debug('download:done', { url, bytes: buf.byteLength, ct });
    return { buf, ct };
  } finally {
    clearTimeout(t);
  }
}

async function downloadWithRetry(url, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      return await withTimeout(download(url, 30000), 35000, `download:${i}:${url}`);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  throw last;
}

async function uploadTo(bucket, path, buf, ct) {
  debug('upload:start', { bucket, path, bytes: buf?.byteLength ?? 0, ct });

  const p = supabase.storage.from(bucket).upload(path, new Uint8Array(buf), {
    contentType: ct,
    upsert: true,
  });

  const { error } = await sb(p, `upload:${bucket}:${path}`, 60000);
  if (error) throw error;

  debug('upload:done', { bucket, path });
}

/* ============ DB helpers ============ */

async function adExistsInDb(adId) {
  const p = supabase
    .from('ads_library')
    .select('ad_archive_id')
    .eq('ad_archive_id', adId)
    .maybeSingle();

  const { data, error } = await sb(p, `adExistsInDb:${adId}`, 15000);
  if (error) throw error;
  return !!data;
}

async function cardsExist(adId) {
  const p = supabase
    .from('ad_cards')
    .select('id', { count: 'exact', head: true })
    .eq('ad_archive_id', adId);

  const { count, error } = await sb(p, `cardsExist:${adId}`, 15000);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function getAdsLibraryPaths(adId) {
  const p = supabase
    .from('ads_library')
    .select('image_url,video_hd_url,video_preview_image_url')
    .eq('ad_archive_id', adId)
    .maybeSingle();

  const { data, error } = await sb(p, `getAdsLibraryPaths:${adId}`, 15000);
  if (error) throw error;

  return {
    image_url: data?.image_url || null,
    video_hd_url: data?.video_hd_url || null,
    video_preview_image_url: data?.video_preview_image_url || null,
  };
}

function isMainSaved(adId, image_url) {
  return typeof image_url === 'string' && image_url.startsWith(`ads/${adId}/${adId}.`);
}
function isVideoSaved(adId, video_hd_url) {
  return typeof video_hd_url === 'string' && video_hd_url.startsWith(`ads/${adId}/${adId}.`);
}
function isVideoPreviewSaved(adId, video_preview_image_url) {
  return (
    typeof video_preview_image_url === 'string' &&
    video_preview_image_url.startsWith(`ads/${adId}/${adId}.`)
  );
}

/* ============ media extractors ============ */

const asArray = (x) => (Array.isArray(x) ? x : []);

function extractVideo(ad) {
  const snap = ad?.snapshot || {};
  return snap?.videos?.[0] || ad?.videos?.[0] || ad?.creative?.videos?.[0] || null;
}

function detectCreativeType(ad) {
  const snap = ad?.snapshot || {};
  const v = extractVideo(ad);

  if (
    v?.video_hd_url ||
    v?.video_sd_url ||
    v?.url ||
    snap?.video_hd_url ||
    snap?.video_url ||
    ad?.video_url
  ) {
    return 'video';
  }

  const hasCards = (snap?.cards?.length ?? 0) > 0 || (ad?.cards?.length ?? 0) > 0;
  const hasImages = (snap?.images?.length ?? 0) > 0 || (ad?.images?.length ?? 0) > 0;
  const hasImageUrl = !!(snap?.image_url || ad?.image_url);

  if (hasCards || hasImages || hasImageUrl) return 'photo';
  return 'unknown';
}

/* ============ save main + cards + video ============ */

async function saveMainPhoto(ad) {
  const adId = String(ad?.ad_archive_id ?? '');
  const src =
    ad?.snapshot?.cards?.[0]?.original_image_url ||
    ad?.snapshot?.cards?.[0]?.resized_image_url ||
    ad?.cards?.[0]?.original_image_url ||
    ad?.cards?.[0]?.resized_image_url ||
    ad?.snapshot?.images?.[0]?.original_image_url ||
    ad?.snapshot?.images?.[0]?.resized_image_url ||
    ad?.images?.[0]?.original_image_url ||
    ad?.images?.[0]?.resized_image_url ||
    ad?.snapshot?.image_url ||
    ad?.image_url ||
    ad?.creative?.images?.[0] ||
    null;

  if (!adId || !src) return null;

  const { buf, ct } = await limitIo(() => downloadWithRetry(src));
  const ext = extFromCT(ct);
  const p = `ads/${adId}/${adId}.${ext}`;

  await limitIo(() => uploadTo(BUCKET_PHOTO, p, buf, ct));
  return p;
}

async function saveCards(ad) {
  const adId = String(ad?.ad_archive_id ?? '');
  const cards = asArray(ad?.snapshot?.cards ?? ad?.cards ?? ad?.creative?.cards ?? []);
  if (!adId || !cards.length) return [];

  const jobs = cards.map((c, i) =>
    limitIo(async () => {
      const src = c?.original_image_url || c?.resized_image_url;
      if (!src) return null;

      const { buf, ct } = await downloadWithRetry(src);
      const ext = extFromCT(ct);
      const p = `ads/${adId}/cards/${i}.${ext}`;

      await uploadTo(BUCKET_PHOTO, p, buf, ct);

      return {
        ad_archive_id: adId,
        card_index: i,
        storage_bucket: BUCKET_PHOTO,
        storage_path: p,
        source_url: src,
      };
    })
  );

  return (await Promise.all(jobs)).filter(Boolean);
}

async function upsertCards(rows) {
  if (!rows.length) return;
  const p = supabase.from('ad_cards').upsert(rows, { onConflict: 'ad_archive_id,card_index' });
  const { error } = await sb(p, `upsertCards:${rows[0]?.ad_archive_id ?? '?'}`, 20000);
  if (error) throw error;
}

async function saveVideoAndPreview(ad) {
  const adId = String(ad?.ad_archive_id ?? '');
  const v = extractVideo(ad) || {};
  const snap = ad?.snapshot || {};

  const videoSrc =
    v?.video_hd_url ||
    v?.video_sd_url ||
    v?.url ||
    snap?.video_hd_url ||
    snap?.video_url ||
    ad?.video_url ||
    null;

  const previewSrc =
    v?.video_preview_image_url || v?.preview_image_url || snap?.video_preview_image_url || null;

  let videoPath = null;
  let previewPath = null;

  if (videoSrc) {
    const { buf } = await limitIo(() => downloadWithRetry(videoSrc));
    videoPath = `ads/${adId}/${adId}.mp4`;
    await limitIo(() => uploadTo(BUCKET_VIDEO, videoPath, buf, 'video/mp4'));
  }

  if (previewSrc) {
    const { buf, ct } = await limitIo(() => downloadWithRetry(previewSrc));
    const ext = extFromCT(ct);
    previewPath = `ads/${adId}/${adId}.${ext}`;
    await limitIo(() => uploadTo(BUCKET_VIDEO_PREVIEW, previewPath, buf, ct));
  }

  return { videoPath, previewPath };
}

async function upsertAdsLibrary(ad, patch) {
  const adId = String(ad?.ad_archive_id ?? '');
  if (!adId) return;

  const row = {
    ad_archive_id: adId,
    page_name: ad?.snapshot?.page_name ?? ad?.page_name ?? null,
    text: ad?.snapshot?.body?.text ?? null,
    caption: ad?.snapshot?.caption ?? null,
    cta_text: ad?.snapshot?.cta_text ?? null,
    cta_type: ad?.snapshot?.cta_type ?? null,
    display_format: ad?.snapshot?.display_format ?? null,
    link_url: ad?.snapshot?.link_url ?? null,
    title: ad?.snapshot?.title ?? null,
    publisher_platform: Array.isArray(ad?.publisher_platform) ? ad.publisher_platform : null,
    meta_ad_url: ad?.ad_library_url ?? ad?.url ?? null,

    image_url: patch.image_url ?? null,
    video_hd_url: patch.video_hd_url ?? null,
    video_preview_image_url: patch.video_preview_image_url ?? null,

    import_job_id: IMPORT_JOB_ID,
  };

  const p = supabase.from('ads_library').upsert(row, { onConflict: 'ad_archive_id' });
  const { error } = await sb(p, `upsertAdsLibrary:${adId}`, 20000);
  if (error) throw error;
}

/* ============ process one ============ */

async function processAd(ad) {
  const adId = String(ad?.ad_archive_id ?? '').trim();
  if (!adId) return { status: 'skipped', reason: 'no_ad_archive_id' };

  if (SKIP_IF_ALREADY_IN_DB) {
    const exists = await adExistsInDb(adId);
    if (exists) return { status: 'skipped', ad_archive_id: adId, reason: 'already_in_db' };
  }

  const type = detectCreativeType(ad);

  const existing = await getAdsLibraryPaths(adId);
  const skipCards = SKIP_IF_CARDS_EXIST ? await cardsExist(adId) : false;
  const skipMain = SKIP_MAIN_IF_EXISTS ? isMainSaved(adId, existing.image_url) : false;
  const skipVideo = SKIP_VIDEO_IF_EXISTS ? isVideoSaved(adId, existing.video_hd_url) : false;
  const skipVideoPreview = SKIP_VIDEO_IF_EXISTS
    ? isVideoPreviewSaved(adId, existing.video_preview_image_url)
    : false;

  let image_url = existing.image_url;
  let video_hd_url = existing.video_hd_url;
  let video_preview_image_url = existing.video_preview_image_url;
  let cards_saved = 0;

  if (type === 'photo') {
    if (!skipMain) image_url = await saveMainPhoto(ad);

    let cardRows = [];
    if (!skipCards) {
      cardRows = await saveCards(ad);
      cards_saved = cardRows.length;
      await upsertCards(cardRows);
    }

    if (!image_url && cardRows.length) image_url = cardRows[0].storage_path;

    if (!image_url && cards_saved === 0) {
      return { status: 'skipped', ad_archive_id: adId, creative_type: type, reason: 'no_photos' };
    }

    await upsertAdsLibrary(ad, { image_url });
  } else if (type === 'video') {
    if (!skipVideo || !skipVideoPreview) {
      const r = await saveVideoAndPreview(ad);
      if (!skipVideo && r.videoPath) video_hd_url = r.videoPath;
      if (!skipVideoPreview && r.previewPath) video_preview_image_url = r.previewPath;
    }

    await upsertAdsLibrary(ad, {
      image_url: image_url ?? null,
      video_hd_url,
      video_preview_image_url,
    });
  } else {
    return { status: 'skipped', ad_archive_id: adId, creative_type: type, reason: 'unknown_type' };
  }

  return {
    status: 'ok',
    ad_archive_id: adId,
    creative_type: type,
    image_url: image_url || '',
    video_hd_url: video_hd_url || '',
    video_preview_image_url: video_preview_image_url || '',
    cards_saved,
  };
}

/* ============ MAIN ============ */

async function main() {
  console.log(`[import] ===== STARTING IMPORT JOB ${IMPORT_JOB_ID} =====`);
  console.log(`[import] Input: ${INPUT}`);
  console.log(`[import] Report: ${REPORT_PATH}`);
  console.log(`[import] Ads concurrency: ${CONCURRENCY}`);
  console.log(`[import] IO concurrency: ${IO_CONCURRENCY}`);
  console.log(`[import] Debug: ${DEBUG}`);
  console.log(`[import] Stop file: ${STOP_FILE || 'none'}`);
  console.log(`[import] Skip if already in DB: ${SKIP_IF_ALREADY_IN_DB}`);

  await fs.writeFile(
    REPORT_PATH,
    'ad_archive_id,status,creative_type,reason,image_url,video_hd_url,video_preview_image_url,cards_saved,error\n',
    'utf8'
  );

  const ads = await loadAdsFromFile();

  console.log(`[import] ✓ Loaded ${ads.length} ads`);
  console.log(JSON.stringify({ event: 'started', total: ads.length, job_id: IMPORT_JOB_ID }));

  let ok = 0,
    skipped = 0,
    failed = 0,
    processed = 0;

  const heartbeat = setInterval(() => {
    console.log(
      JSON.stringify({
        event: 'heartbeat',
        ts: Date.now(),
        ok,
        skipped,
        failed,
        processed,
        total: ads.length,
      })
    );
  }, 10000);

  const progressTick = setInterval(() => {
    console.log(
      JSON.stringify({ event: 'progress', ok, skipped, failed, processed, total: ads.length })
    );
  }, 2000);

  console.log(`[import] ===== STARTING PROCESSING =====`);
  console.log(`[import] Processing ${ads.length} ads with concurrency ${CONCURRENCY}`);

  const jobs = ads.map((ad) =>
    limitAds(async () => {
      if (shouldStop) return;

      const adId = String(ad?.ad_archive_id ?? '').trim();
      try {
        const r = await withTimeout(processAd(ad), 180000, `processAd:${adId}`); // 3 min на ad
        processed++;

        if (r.status === 'ok') ok++;
        else skipped++;

        await appendCsv(
          [
            csvEscape(adId),
            csvEscape(r.status),
            csvEscape(r.creative_type || ''),
            csvEscape(r.reason || ''),
            csvEscape(r.image_url || ''),
            csvEscape(r.video_hd_url || ''),
            csvEscape(r.video_preview_image_url || ''),
            csvEscape(r.cards_saved ?? ''),
            '',
          ].join(',')
        );
      } catch (e) {
        processed++;
        failed++;
        const msg = e?.message || String(e);
        console.error(`[import] ❌ FAILED ${adId}: ${msg}`);
        await appendCsv(
          [csvEscape(adId), 'failed', '', '', '', '', '', '', csvEscape(msg)].join(',')
        );
      }
    })
  );

  await Promise.all(jobs);

  clearInterval(heartbeat);
  clearInterval(progressTick);
  cleanupStopSignal();

  const status = shouldStop ? 'stopped' : 'completed';
  console.log(`[import] ===== PROCESSING COMPLETE =====`);
  console.log(
    JSON.stringify({ event: 'done', status, ok, skipped, failed, processed, total: ads.length })
  );
  console.log(`[import] Report saved to: ${REPORT_PATH}`);
}

main().catch((e) => {
  cleanupStopSignal();
  console.error('[import] ===== FATAL ERROR =====');
  console.error('[import] Error:', e?.message || String(e));
  console.error('[import] Stack:', e?.stack || 'no stack trace');
  process.exit(1);
});
