#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const INPUT = process.argv[2] || 'ads.json';

const SUPABASE_URL = "https://hkpyhgouhgspopowwkcj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrcHloZ291aGdzcG9wb3d3a2NqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUzOTk3NywiZXhwIjoyMDgxMTE1OTc3fQ.x7j7DCMSMi0uBh-HcHQZOlzsKnw9SklFQ6woxwQnx4s"

const TABLE = process.env.TABLE || 'duplicate_2data_base_blinkist';
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);
const UPDATE_CONCURRENCY = Number(process.env.UPDATE_CONCURRENCY || 10);
const DRY_RUN = (process.env.DRY_RUN ?? 'false') === 'true';
const START_BATCH = Number(process.env.START_BATCH || 1);

const RETRIES = Number(process.env.RETRIES || 6);
const BASE_DELAY_MS = Number(process.env.BASE_DELAY_MS || 600);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function looksLikeAd(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return typeof obj.ad_archive_id === 'string' || typeof obj.id === 'string' || !!obj.snapshot;
}

function extractAdsArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const keys = ['data', 'items', 'ads', 'results', 'rows'];
    for (const k of keys) if (Array.isArray(payload[k])) return payload[k];
    if (looksLikeAd(payload)) return [payload];
  }
  throw new Error('Unsupported JSON shape');
}

function parseNdjson(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((ln) => {
      try { return JSON.parse(ln); } catch { return null; }
    })
    .filter(Boolean);
}

async function loadAdsFromFile(path) {
  const raw = await fs.readFile(path, 'utf8');
  const text = raw.trim();
  if (!text) throw new Error('Input file is empty');
  try {
    const payload = JSON.parse(text);
    return extractAdsArray(payload).filter(Boolean);
  } catch {
    const nd = parseNdjson(text);
    if (!nd.length) throw new Error('Failed to parse JSON/NDJSON');
    return nd;
  }
}

function buildPatch(ad) {
  const adId = String(ad?.ad_archive_id ?? '').trim();
  if (!adId) return null;
  
  const linkUrl = ad?.snapshot?.link_url ?? ad?.link_url ?? null;
  const url = ad?.url ?? null;
  
  if (!linkUrl && !url) return null;
  
  return { 
    ad_archive_id: adId, 
    link_url: linkUrl,
    url: url
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e?.message || String(e);
      const delay = BASE_DELAY_MS * Math.pow(2, i);
      console.warn(`[retry] ${label} failed: ${msg} (try ${i + 1}/${RETRIES + 1}) -> sleep ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function getExistingIds(ids) {
  const run = async () => {
    const { data, error } = await supabase.from(TABLE).select('ad_archive_id').in('ad_archive_id', ids);
    if (error) throw error;
    return new Set((data || []).map((r) => String(r.ad_archive_id)));
  };
  return await withRetry(run, `select-existing(${ids.length})`);
}

async function updateOneRow(patch) {
  const id = patch.ad_archive_id;
  const updatePayload = {};
  
  if (patch.link_url) updatePayload.link_url = patch.link_url;
  if (patch.url) updatePayload.url = patch.url;
  
  if (!Object.keys(updatePayload).length) return 0;

  if (DRY_RUN) {
    console.log(`[dry-run] Would update ${id}:`, updatePayload);
    return 1;
  }

  const run = async () => {
    const { error } = await supabase.from(TABLE).update(updatePayload).eq('ad_archive_id', id);
    if (error) throw error;
    return 1;
  };
  return await withRetry(run, `update(${id})`);
}

async function mapLimit(items, limit, worker) {
  let i = 0;
  const results = new Array(items.length);
  async function runOne() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, limit) }, runOne));
  return results;
}

async function processBatch(batch, idx, total) {
  const ids = batch.map((x) => x.ad_archive_id);
  const existingSet = await getExistingIds(ids);

  const existing = batch.filter((x) => existingSet.has(x.ad_archive_id));
  const missing = batch.length - existing.length;

  if (!existing.length) {
    console.log(`[batch ${idx + 1}/${total}] existing=0 missing=${missing} -> skip`);
    return { updated: 0, missing };
  }

  const res = await mapLimit(existing, UPDATE_CONCURRENCY, async (p) => updateOneRow(p));
  const updated = res.reduce((a, b) => a + (b || 0), 0);

  console.log(
    `[batch ${idx + 1}/${total}] existing=${existing.length} missing=${missing} updated=${updated}${DRY_RUN ? ' (dry-run)' : ''}`
  );
  return { updated, missing };
}

async function main() {
  console.log(
    `[update-urls] input=${INPUT} table=${TABLE} batch=${BATCH_SIZE} upd_conc=${UPDATE_CONCURRENCY} dry_run=${DRY_RUN} start_batch=${START_BATCH}`
  );

  const ads = await loadAdsFromFile(INPUT);
  console.log(`[update-urls] loaded ads: ${ads.length}`);

  const patches = [];
  for (const ad of ads) {
    const p = buildPatch(ad);
    if (p) patches.push(p);
  }

  console.log(`[update-urls] patches=${patches.length}`);

  const batches = chunk(patches, BATCH_SIZE);
  console.log(`[update-urls] total batches: ${batches.length}`);

  let updatedTotal = 0;
  let missingTotal = 0;

  for (let i = START_BATCH - 1; i < batches.length; i++) {
    const r = await processBatch(batches[i], i, batches.length);
    updatedTotal += r.updated;
    missingTotal += r.missing;
  }

  console.log(`[update-urls] DONE updated=${updatedTotal} missing_in_db=${missingTotal}`);
}

main().catch((e) => {
  console.error('[update-urls] FATAL:', e?.message || String(e));
  process.exit(1);
});
