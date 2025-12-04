#!/usr/bin/env node
/*
  cleanup-orphaned-storage.mjs

  Usage:
    node cleanup-orphaned-storage.mjs --buckets=test9bucket_photo,test10public_preview --dry-run

  This script will:
  - enumerate objects in the provided Supabase storage buckets
  - extract `ad_archive_id` from filenames (strip extensions)
  - query the `ads_library` table for existing `ad_archive_id`s
  - delete objects whose `ad_archive_id` is not present in the DB

  Requirements:
  - set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your environment
  - Node 18+ (or a runtime that supports top-level await)

  Safety:
  - The default is `--dry-run` which reports what it would delete.
  - Remove `--dry-run` to actually perform deletions.
*/

import { createClient } from '@supabase/supabase-js';
try {
  const mod = await import('dotenv');
  const dot = mod.default ?? mod;
  dot.config({ path: '../.env.local' });
} catch (e) {
  console.warn('dotenv not available — skipping .env loading');
}
// Simple CLI flag parsing to avoid external dependencies
function parseFlags(argv) {
  const out = { buckets: null, dryRun: true, concurrency: 5 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--buckets=')) out.buckets = a.split('=')[1];
    else if (a === '--buckets' && argv[i + 1]) {
      out.buckets = argv[i + 1];
      i++;
    } else if (a === '-b' && argv[i + 1]) {
      out.buckets = argv[i + 1];
      i++;
    } else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--no-dry-run') out.dryRun = false;
    else if (a.startsWith('--concurrency=')) out.concurrency = Number(a.split('=')[1]) || 5;
    else if (a === '--concurrency' && argv[i + 1]) {
      out.concurrency = Number(argv[i + 1]) || 5;
      i++;
    }
  }
  return out;
}

const parsed = parseFlags(process.argv);
const bucketsArg = parsed.buckets;
if (!bucketsArg) {
  console.error(
    'Error: --buckets is required. Example: --buckets=test9bucket_photo,test10public_preview'
  );
  process.exit(1);
}

const BUCKETS = bucketsArg
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const DRY_RUN = Boolean(parsed.dryRun);
const CONCURRENCY = Math.max(1, Number(parsed.concurrency) || 5);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.');
  process.exit(1);
}

// supabase-js will use global fetch in Node 18+. No need to pass node-fetch.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractAdArchiveIdFromFilename(filename) {
  // strip directories, then strip trailing extensions (.jpeg, .jpg, .mp4, .webp, .png)
  const parts = String(filename).split('/').filter(Boolean);
  const name = parts[parts.length - 1];
  // Remove common image/video extensions
  return name.replace(/\.(jpe?g|png|webp|mp4|mov|avi|gif)$/i, '');
}

async function listAllObjects(bucket) {
  const results = [];
  let page = 0;
  let { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000, offset: 0 });
  if (error) {
    throw new Error(`Failed to list bucket ${bucket}: ${error.message}`);
  }
  results.push(...(data || []));

  // If there are more than 1000 objects, page through using offset
  while ((data || []).length === 1000) {
    page += 1;
    const offset = page * 1000;
    const res = await supabase.storage.from(bucket).list('', { limit: 1000, offset });
    if (res.error) throw new Error(`Failed to list bucket ${bucket}: ${res.error.message}`);
    data = res.data;
    results.push(...(data || []));
  }
  return results;
}

async function fetchExistingAdArchiveIds(adArchiveIds) {
  // Query the DB for rows that match any of the ad_archive_id values
  // We'll query in chunks to avoid large IN clauses
  const uniqueIds = Array.from(new Set(adArchiveIds.map((s) => String(s))));
  const found = new Set();
  const chunkSize = 500;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('ads_library')
      .select('ad_archive_id')
      .in('ad_archive_id', chunk)
      .limit(chunk.length);

    if (error) {
      throw new Error(`DB query failed: ${error.message}`);
    }
    if (Array.isArray(data)) {
      for (const r of data) {
        if (r && r.ad_archive_id != null) found.add(String(r.ad_archive_id));
      }
    }
  }
  return found;
}

async function deleteObjects(bucket, objects, dryRun = true) {
  // objects: array of { name }
  const toDelete = objects.map((o) => o.name);
  if (toDelete.length === 0) return { deleted: 0, attempted: 0 };

  if (dryRun) {
    for (const n of toDelete) console.log(`[DRY] would delete: ${bucket}/${n}`);
    return { deleted: 0, attempted: toDelete.length };
  }

  // Delete in batches because supabase-js supports up to many per call but safety first
  const batchSize = 100;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.error(`Failed removing batch in ${bucket}: ${error.message}`);
    } else {
      deleted += Array.isArray(data) ? data.length : batch.length;
      for (const n of batch) console.log(`deleted: ${bucket}/${n}`);
    }
  }

  return { deleted, attempted: toDelete.length };
}

(async function main() {
  try {
    console.log('Buckets:', BUCKETS.join(', '));
    console.log('Dry run:', DRY_RUN ? 'YES' : 'NO');

    // 1) List files
    const bucketObjects = {};
    for (const b of BUCKETS) {
      console.log(`Listing bucket: ${b}`);
      const objs = await listAllObjects(b);
      bucketObjects[b] = objs;
      console.log(`  found ${objs.length} objects in ${b}`);
    }

    // 2) Build ad_archive_id -> files map
    const idToFiles = new Map();
    const allIds = [];
    for (const [bucket, objs] of Object.entries(bucketObjects)) {
      for (const obj of objs) {
        if (!obj || !obj.name) continue;
        const id = extractAdArchiveIdFromFilename(obj.name);
        if (!id) continue;
        allIds.push(id);
        const key = String(id);
        if (!idToFiles.has(key)) idToFiles.set(key, []);
        idToFiles.get(key).push({ bucket, name: obj.name });
      }
    }

    console.log(`Unique ad_archive_id candidates from storage: ${new Set(allIds).size}`);

    // 3) Query DB for existing ad_archive_id
    const foundSet = await fetchExistingAdArchiveIds(allIds);
    console.log(`Found ${foundSet.size} matching ad_archive_id rows in DB`);

    // 4) Determine orphaned files
    const orphanFilesByBucket = {};
    for (const [id, files] of idToFiles.entries()) {
      if (!foundSet.has(String(id))) {
        for (const f of files) {
          if (!orphanFilesByBucket[f.bucket]) orphanFilesByBucket[f.bucket] = [];
          orphanFilesByBucket[f.bucket].push({ name: f.name });
        }
      }
    }

    // 5) Report and optionally delete
    let totalAttempted = 0;
    let totalDeleted = 0;
    for (const b of BUCKETS) {
      const list = orphanFilesByBucket[b] || [];
      console.log(`Bucket ${b}: ${list.length} orphaned files`);
      if (list.length > 0) {
        const res = await deleteObjects(b, list, DRY_RUN);
        totalAttempted += res.attempted || 0;
        totalDeleted += res.deleted || 0;
      }
    }

    console.log('Done.');
    console.log(`Attempted: ${totalAttempted}, Deleted: ${totalDeleted}`);
    if (DRY_RUN) console.log('Dry run enabled; no objects were actually deleted.');
  } catch (err) {
    console.error('Error in cleanup script:', err);
    process.exit(2);
  }
})();
