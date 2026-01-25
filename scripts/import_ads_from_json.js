import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { createClient } from '@supabase/supabase-js';

/* ================= ⚙️ CONFIG ================= */
const CONFIG = {
  supabaseUrl: 'https://hkpyhgouhgspopowwkcj.supabase.co',
  // Ensure this key has no Cyrillic characters
  supabaseKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrcHloZ291aGdzcG9wb3d3a2NqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUzOTk3NywiZXhwIjoyMDgxMTE1OTc3fQ.x7j7DCMSMi0uBh-HcHQZOlzsKnw9SklFQ6woxwQnx4s',

  tableName: 'data_base',
  bucketName: 'test2',

  concurrency: 20,
  ioConcurrency: 40,
  timeoutMs: 30000,

  skipIfAlreadyInDb: true,
};

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: { persistSession: false },
});

const limitAds = pLimit(CONFIG.concurrency);
const limitIo = pLimit(CONFIG.ioConcurrency);

/* ================= 🔩 UTILS ================= */

const toDateOnly = (val) => {
  if (val == null || val === '') return null;
  let d =
    typeof val === 'number' || (!isNaN(val) && !isNaN(parseFloat(val)))
      ? new Date(Number(val) < 10000000000 ? val * 1000 : val)
      : new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const withTimeout = (promise, ms, label) => {
  let t;
  return Promise.race([
    promise,
    new Promise((_, r) => (t = setTimeout(() => r(new Error(`Timeout ${label}`)), ms))),
  ]).finally(() => clearTimeout(t));
};

/* ================= 📦 OPERATIONS ================= */

async function getJsonFiles(targetPath) {
  const stats = await fs.stat(targetPath);
  if (stats.isFile()) return [targetPath];
  const files = await fs.readdir(targetPath);
  return files
    .filter((f) => path.extname(f).toLowerCase() === '.json')
    .map((f) => path.join(targetPath, f));
}

async function extractAds(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    const keys = ['data', 'items', 'ads', 'results'];
    for (const k of keys) {
      if (Array.isArray(parsed?.[k])) return parsed[k];
      if (parsed?.[k]?.items && Array.isArray(parsed[k].items)) return parsed[k].items;
    }
    return parsed?.ad_archive_id ? [parsed] : [];
  } catch (e) {
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }
}

async function uploadMedia(adId, url) {
  return limitIo(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Media fetch failed (${r.status})`);
    const buf = await r.arrayBuffer();
    const storagePath = `${adId}.png`;

    const { error } = await supabase.storage
      .from(CONFIG.bucketName)
      .upload(storagePath, new Uint8Array(buf), { upsert: true });

    if (error) throw new Error(`Upload error: ${error.message}`);
    return storagePath;
  });
}

async function upsertAd(ad, storagePath) {
  const snap = ad?.snapshot || {};
  const cards = snap?.cards || ad?.cards || [];
  const platforms = Array.isArray(snap.publisher_platforms)
    ? snap.publisher_platforms.join(', ')
    : snap.publisher_platforms ?? null;

  const row = {
    ad_archive_id: String(ad.ad_archive_id),
    page_name: snap.page_name ?? ad.page_name ?? null,
    publisher_platform: platforms,
    text: snap.body?.text ?? ad.text ?? null,
    caption: snap.caption ?? ad.caption ?? null,
    title: snap.title ?? ad.title ?? null,
    start_date_formatted: toDateOnly(snap.start_date ?? ad.start_date),
    end_date_formatted: toDateOnly(snap.end_date ?? ad.end_date),
    link_to_creative: storagePath,
    link_url: snap.link_url ?? ad.link_url ?? null,
    cards_json: cards.length ? cards : null,
    cards_count: cards.length,
    raw_json: ad,
  };

  const { error } = await supabase
    .from(CONFIG.tableName)
    .upsert(row, { onConflict: 'ad_archive_id' });
  if (error) throw new Error(`DB error: ${error.message}`);
}

async function processAd(ad) {
  const adId = String(ad?.ad_archive_id || '').trim();
  if (!adId) return { status: 'skipped', reason: 'Missing Archive ID' };

  if (CONFIG.skipIfAlreadyInDb) {
    const { data } = await supabase
      .from(CONFIG.tableName)
      .select('ad_archive_id')
      .eq('ad_archive_id', adId)
      .maybeSingle();
    if (data) return { status: 'skipped', reason: 'Duplicate (Already in DB)' };
  }

  const snap = ad?.snapshot || {};
  const v = snap?.videos?.[0] || ad?.videos?.[0] || {};
  const mediaUrl =
    snap?.cards?.[0]?.original_image_url ||
    snap?.images?.[0]?.original_image_url ||
    v?.video_preview_image_url ||
    ad?.image_url;

  if (!mediaUrl) return { status: 'skipped', reason: 'No media URL found' };

  const storagePath = await uploadMedia(adId, mediaUrl);
  await upsertAd(ad, storagePath);
  return { status: 'ok' };
}

/* ================= 🚀 MAIN ================= */

async function main() {
  const INPUT_PATH = process.argv[2] || './ads';
  console.log(`📂 Scanning: ${INPUT_PATH}`);

  const files = await getJsonFiles(INPUT_PATH);
  console.log(`📄 Found ${files.length} files\n`);

  let totalStats = { ok: 0, skipped: 0, failed: 0 };
  const globalSkipReasons = new Map();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ads = await extractAds(file);
    let fileProcessed = 0;
    let fileStats = { ok: 0, skipped: 0, failed: 0 };
    const fileSkipReasons = new Map();

    console.log(
      `[File ${i + 1}/${files.length}] 🔍 ${path.basename(file)} (${ads.length} entries)`
    );

    await Promise.all(
      ads.map((ad) =>
        limitAds(async () => {
          try {
            const r = await withTimeout(processAd(ad), CONFIG.timeoutMs, ad.ad_archive_id);
            if (r.status === 'ok') {
              fileStats.ok++;
              totalStats.ok++;
            } else {
              fileStats.skipped++;
              totalStats.skipped++;
              fileSkipReasons.set(r.reason, (fileSkipReasons.get(r.reason) || 0) + 1);
              globalSkipReasons.set(r.reason, (globalSkipReasons.get(r.reason) || 0) + 1);
            }
          } catch (e) {
            fileStats.failed++;
            totalStats.failed++;
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            console.error(`   ❌ Error [${ad.ad_archive_id}]: ${e.message}`);
          } finally {
            fileProcessed++;
            process.stdout.write(
              `   Progress: ${fileProcessed}/${ads.length} (${Math.round(
                (fileProcessed / ads.length) * 100
              )}%)\r`
            );
          }
        })
      )
    );

    console.log(
      `\n   ✅ File results: OK: ${fileStats.ok} | Skipped: ${fileStats.skipped} | Failed: ${fileStats.failed}`
    );
    if (fileSkipReasons.size > 0) {
      fileSkipReasons.forEach((count, reason) => {
        console.log(`      -> Skip Reason [${reason}]: ${count}`);
      });
    }
  }

  console.log('\n📊 FINAL GLOBAL SUMMARY:');
  console.table(totalStats);

  if (globalSkipReasons.size > 0) {
    console.log('\n⏭️  TOTAL SKIP REASONS BREAKDOWN:');
    globalSkipReasons.forEach((count, reason) => {
      console.log(`   - ${reason}: ${count} total items`);
    });
  }
}

main().catch((err) => {
  console.error('💥 Fatal Error:', err);
  process.exit(1);
});
