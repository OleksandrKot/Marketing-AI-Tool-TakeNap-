#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ANSI colors for nicer terminal output
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

// If a .env.local file exists, load simple KEY=VALUE pairs into process.env
// unless those vars are already set in the environment. This makes running
// the script locally easier (you don't have to `set` each variable manually).
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=("?)(.*)\2$/);
      if (m) {
        const key = m[1];
        let val = m[3];
        // remove surrounding quotes if present
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) {
  // don't fail if .env.local can't be read; we'll fall back to explicit env vars
}

function usage() {
  console.log(
    'Usage: node scripts/cleanup-orphaned-ads.mjs [--dry-run] [--limit N] [--buckets a,b,c] [--older-than YYYY-MM-DD] [--yes]'
  );
  console.log(
    'Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY required. Optionally CLEANUP_BUCKETS (comma list).'
  );
}

async function main() {
  const args = process.argv.slice(2);
  const opts = {
    dryRun: args.includes('--dry-run'),
    yes: args.includes('--yes'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    limit: null,
    buckets: null,
    olderThan: null,
  };

  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) opts.limit = Number(args[limitIndex + 1]);
  const bucketsIndex = args.indexOf('--buckets');
  if (bucketsIndex !== -1 && args[bucketsIndex + 1])
    opts.buckets = args[bucketsIndex + 1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const olderIndex = args.indexOf('--older-than');
  if (olderIndex !== -1 && args[olderIndex + 1]) opts.olderThan = args[olderIndex + 1];

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
    usage();
    process.exit(1);
  }

  const defaultBuckets = process.env.CLEANUP_BUCKETS
    ? process.env.CLEANUP_BUCKETS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const buckets =
    opts.buckets && opts.buckets.length
      ? opts.buckets
      : defaultBuckets.length
      ? defaultBuckets
      : ['test9bucket_photo', 'test8public', 'test10public_preview'];

  // Buckets we should never delete objects from automatically (image-only buckets)
  const preserveBuckets = process.env.CLEANUP_PRESERVE_BUCKETS
    ? process.env.CLEANUP_PRESERVE_BUCKETS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['test9bucket_photo'];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log(
    `${CYAN}Starting cleanup${RESET} (dryRun=%s) scan buckets=%s`,
    opts.dryRun,
    buckets.join(',')
  );

  // fetch ads
  let query = supabase
    .from('ads_library')
    .select(
      'id,ad_archive_id,image_url,video_hd_url,video_preview_image_url,created_at,concept,realisation,topic,hook,character'
    );
  if (opts.olderThan) query = query.lt('created_at', opts.olderThan);
  if (opts.limit && typeof opts.limit === 'number') query = query.limit(opts.limit);

  const { data: ads, error } = await query;
  if (error) {
    console.error('Failed to query ads:', error.message || error);
    process.exit(2);
  }

  if (!ads || ads.length === 0) {
    console.log('No ads found to scan');
    return;
  }

  // Normalize a URL or filename to a simple storage object key.
  // Examples it handles:
  // - https://.../storage/v1/object/public/bucket/path/12345.mp4?token=...  => 12345.mp4
  // - https://video.cdn/.../12345.mp4?_nc_... => 12345.mp4
  // - 12345.mp4 => 12345.mp4
  function normalizeKey(raw) {
    if (!raw) return null;
    try {
      let s = String(raw).trim();
      // If contains storage public marker, take the rest after it
      const marker = '/storage/v1/object/public/';
      const idx = s.indexOf(marker);
      if (idx !== -1) s = s.slice(idx + marker.length);
      // Remove query string and fragment
      const qidx = s.indexOf('?');
      if (qidx !== -1) s = s.slice(0, qidx);
      const hashIdx = s.indexOf('#');
      if (hashIdx !== -1) s = s.slice(0, hashIdx);
      // If looks like a full URL, take last path segment
      if (s.includes('://')) {
        try {
          const u = new URL(s);
          s = u.pathname.split('/').pop() || s;
        } catch (e) {
          // fallback: last segment
          s = s.split('/').pop();
        }
      } else if (s.includes('/')) {
        s = s.split('/').pop();
      }
      return s || null;
    } catch (e) {
      return null;
    }
  }

  const toDelete = [];
  const details = {};
  const report = [];

  for (const ad of ads) {
    // Build candidate keys for different buckets, normalizing any URLs
    const videoCandidates = [];
    const previewCandidates = [];
    const otherCandidates = [];

    const imgKey = normalizeKey(ad.image_url);
    if (imgKey) otherCandidates.push(imgKey);
    const previewKey = normalizeKey(ad.video_preview_image_url);
    if (previewKey) previewCandidates.push(previewKey);
    const videoKey = normalizeKey(ad.video_hd_url);
    if (videoKey) videoCandidates.push(videoKey);
    if (ad.ad_archive_id) {
      videoCandidates.push(`${ad.ad_archive_id}.mp4`);
      previewCandidates.push(
        `${ad.ad_archive_id}.jpeg`,
        `${ad.ad_archive_id}.jpg`,
        `${ad.ad_archive_id}.png`
      );
      otherCandidates.push(
        `${ad.ad_archive_id}.jpeg`,
        `${ad.ad_archive_id}.jpg`,
        `${ad.ad_archive_id}.png`,
        `${ad.ad_archive_id}.mp4`
      );
    }

    const uniqueVideo = Array.from(new Set(videoCandidates.filter(Boolean)));
    const uniquePreview = Array.from(new Set(previewCandidates.filter(Boolean)));
    const uniqueOther = Array.from(new Set(otherCandidates.filter(Boolean)));

    const checked = [];
    const bucketResults = {}; // bucketName -> { tried: [key], found: [key], errors: [msg] }
    // Helper to check existence in a bucket for a list of keys
    async function anyExistsInBucket(bucketName, keys) {
      if (!bucketResults[bucketName])
        bucketResults[bucketName] = { tried: [], found: [], errors: [] };
      for (const k of keys) {
        if (!k) continue;
        checked.push(`${bucketName}/${k}`);
        bucketResults[bucketName].tried.push(k);
        try {
          const res = await supabase.storage.from(bucketName).createSignedUrl(k, 10);
          if (res && res.data && res.data.signedUrl) {
            bucketResults[bucketName].found.push(k);
            if (opts.verbose) console.log(`    ${GREEN}[FOUND]${RESET} ${bucketName}/${k}`);
            return k;
          }
          // If res.error, we ignore not-found and warn on other errors
          if (res && res.error) {
            const msg = (res.error && res.error.message) || String(res.error);
            bucketResults[bucketName].errors.push({ key: k, message: msg });
            if (!/no resource with given identifier/i.test(msg)) {
              console.warn(`${RED}Storage error checking${RESET}`, bucketName, k, msg);
            } else if (opts.verbose) {
              console.log(`    ${YELLOW}[NOT FOUND]${RESET} ${bucketName}/${k}`);
            }
          } else if (opts.verbose) {
            console.log(`    ${YELLOW}[NOT FOUND]${RESET} ${bucketName}/${k}`);
          }
        } catch (e) {
          const msg = e && e.message ? e.message : String(e);
          bucketResults[bucketName].errors.push({ key: k, message: msg });
          console.warn(`${RED}Exception checking storage${RESET}`, bucketName, k, msg);
        }
      }
      return null;
    }

    // Pairing: treat test8public as video bucket and test10public_preview as preview bucket when present
    const hasTest8 = buckets.includes('test8public');
    const hasTest10 = buckets.includes('test10public_preview');

    let videoFoundKey = null;
    let previewFoundKey = null;
    let image9FoundKey = null;

    if (hasTest8 && hasTest10) {
      // Check paired logic
      videoFoundKey = await anyExistsInBucket('test8public', uniqueVideo.concat(uniqueOther));
      previewFoundKey = await anyExistsInBucket(
        'test10public_preview',
        uniquePreview.concat(uniqueOther)
      );

      // If video exists but preview missing -> mark for deletion (delete video)
      // If preview exists but video missing -> mark for deletion (delete preview)
      // If neither exists -> fall back to checking other buckets
      if (!videoFoundKey && !previewFoundKey) {
        // fallback: check remaining buckets in the general way
        for (const bucket of buckets) {
          if (bucket === 'test8public' || bucket === 'test10public_preview') continue;
          const any = await anyExistsInBucket(bucket, uniqueOther);
          if (any) {
            videoFoundKey = videoFoundKey || null;
            previewFoundKey = previewFoundKey || null;
            break;
          }
        }
      }
    } else {
      // General check across all buckets for any candidate
      for (const bucket of buckets) {
        if (!videoFoundKey) videoFoundKey = await anyExistsInBucket(bucket, uniqueVideo);
        if (!previewFoundKey) previewFoundKey = await anyExistsInBucket(bucket, uniquePreview);
        if (!videoFoundKey && !previewFoundKey) {
          // also check other candidate keys
          const any = await anyExistsInBucket(bucket, uniqueOther);
          if (any) {
            // treat as found (we don't know type)
            previewFoundKey = previewFoundKey || any;
            videoFoundKey = videoFoundKey || any;
          }
        }
        if (videoFoundKey && previewFoundKey) break;
      }
    }
    // Also check explicitly for images in test9bucket_photo (image-only ads)
    if (buckets.includes('test9bucket_photo')) {
      image9FoundKey = await anyExistsInBucket('test9bucket_photo', uniqueOther);
    }

    // Decision
    const entry = {
      id: ad.id,
      ad_archive_id: ad.ad_archive_id || null,
      concept: ad.concept || null,
      realisation: ad.realisation || null,
      topic: ad.topic || null,
      hook: ad.hook || null,
      character: ad.character || null,
      videoFound: !!videoFoundKey,
      previewFound: !!previewFoundKey,
      checked,
      bucketResults,
    };
    report.push(entry);

    let orphan = false;
    // Keep rules:
    // - If there is an image in test9bucket_photo -> KEEP
    // - Else if both video (test8) AND preview (test10) exist -> KEEP
    // - Otherwise -> ORPHAN (delete both DB row and any storage objects found for this ad)
    if (image9FoundKey) {
      orphan = false;
    } else if (videoFoundKey && previewFoundKey) {
      orphan = false;
    } else {
      orphan = true;
    }

    if (orphan) {
      toDelete.push(ad.id);
      details[ad.id] = entry;
    }
    // Print a concise human-readable summary per ad (colored)
    const vidLabel = videoFoundKey
      ? `${GREEN}video=FOUND${RESET}`
      : `${YELLOW}video=MISSING${RESET}`;
    const prevLabel = previewFoundKey
      ? `${GREEN}preview=FOUND${RESET}`
      : `${YELLOW}preview=MISSING${RESET}`;
    const action = orphan ? `${RED}ORPHAN -> would delete${RESET}` : `${GREEN}KEEP${RESET}`;
    // Include short metadata summary in human-readable output
    // Include all relevant metadata fields in the short summary
    const metaParts = [];
    if (ad.concept) metaParts.push(`concept=${ad.concept}`);
    if (ad.realisation) metaParts.push(`realisation=${ad.realisation}`);
    if (ad.topic) metaParts.push(`topic=${ad.topic}`);
    if (ad.hook) metaParts.push(`hook=${ad.hook}`);
    if (ad.character) metaParts.push(`character=${ad.character}`);
    if (ad.ad_archive_id) metaParts.push(`archive=${ad.ad_archive_id}`);
    const meta = metaParts.length ? ` (${metaParts.join('; ')})` : '';
    console.log(
      `${CYAN}AD ${ad.id}${RESET} archive=${
        ad.ad_archive_id || '-'
      }: ${vidLabel}, ${prevLabel} -> ${action}${meta}`
    );
    if (opts.verbose) {
      // show per-bucket details
      for (const [bname, br] of Object.entries(bucketResults)) {
        const found =
          br.found && br.found.length
            ? `${GREEN}found=${br.found.join(',')}${RESET}`
            : `${YELLOW}found=none${RESET}`;
        const tried = br.tried.join(', ');
        console.log(`  bucket=${bname} tried=[${tried}] ${found}`);
        if (br.errors && br.errors.length) {
          for (const e of br.errors)
            console.log(`${RED}    error for ${e.key}:${RESET} ${e.message}`);
        }
      }
    }
  }

  console.log('Scan complete. orphaned candidates:', toDelete.length);
  if (toDelete.length === 0) return;

  if (opts.dryRun) {
    console.log('Dry run enabled; the following IDs would be deleted:', JSON.stringify(toDelete));
    console.log('Details sample:', JSON.stringify(report.slice(0, 10), null, 2));
    // If --report <file> provided, write report
    const repIndex = args.indexOf('--report');
    if (repIndex !== -1 && args[repIndex + 1]) {
      const rf = args[repIndex + 1];
      try {
        fs.writeFileSync(
          rf,
          JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2),
          'utf8'
        );
        console.log('Wrote report to', rf);
      } catch (e) {
        console.warn('Failed to write report', e && e.message ? e.message : e);
      }
    }
    return;
  }

  if (!opts.yes && !process.env.CLEANUP_FORCE) {
    console.log(
      'Not deleting because confirmation missing. Re-run with --yes or set CLEANUP_FORCE=1 to confirm.'
    );
    console.log('IDs to delete:', JSON.stringify(toDelete));
    process.exit(0);
  }

  // Before deleting DB rows, optionally remove paired storage objects when using the test8/test10 pairing
  // When deleting, remove any storage objects that we tried/identified across all configured buckets
  if (toDelete.length > 0) {
    console.log(`${CYAN}Removing storage objects for orphaned ads (if found)${RESET}`);
    for (const adId of toDelete) {
      const info = details[adId];
      if (!info) continue;
      const bucketResultsForAd = info.bucketResults || {};
      const toRemoveByBucket = {};
      // collect keys tried/found per bucket
      for (const b of buckets) {
        const br = bucketResultsForAd[b];
        if (!br) continue;
        const set = new Set(br.tried || []);
        // also include found keys to be safe
        for (const f of br.found || []) set.add(f);
        if (set.size > 0) toRemoveByBucket[b] = Array.from(set);
      }

      if (!opts.yes && !process.env.CLEANUP_FORCE) {
        continue;
      }

      for (const [bucketName, keys] of Object.entries(toRemoveByBucket)) {
        if (!keys || keys.length === 0) continue;
        if (preserveBuckets.includes(bucketName)) {
          console.log(
            `${YELLOW}Skipping deletion in preserved bucket:${RESET}`,
            bucketName,
            'for ad',
            adId
          );
          continue;
        }
        try {
          const { error: remErr } = await supabase.storage.from(bucketName).remove(keys);
          if (remErr)
            console.warn(
              `${RED}Failed to remove objects from${RESET}`,
              bucketName,
              keys,
              remErr.message || remErr
            );
          else
            console.log(
              `${GREEN}Removed${RESET}`,
              keys.length,
              'objects from',
              bucketName,
              'for ad',
              adId
            );
        } catch (e) {
          console.warn(
            `${RED}Exception removing objects from${RESET}`,
            bucketName,
            e && e.message ? e.message : e
          );
        }
      }
    }
  }

  // --- Storage sweep: remove objects that are NOT referenced by any ad in DB ---
  // Build set of referenced basenames from the scanned ads (use normalized keys)
  const referencedBasenames = new Set();
  for (const ad of ads) {
    const keys = [];
    const kImg = normalizeKey(ad.image_url);
    if (kImg) keys.push(kImg);
    const kPrev = normalizeKey(ad.video_preview_image_url);
    if (kPrev) keys.push(kPrev);
    const kVid = normalizeKey(ad.video_hd_url);
    if (kVid) keys.push(kVid);
    if (ad.ad_archive_id) {
      keys.push(
        `${ad.ad_archive_id}.mp4`,
        `${ad.ad_archive_id}.jpeg`,
        `${ad.ad_archive_id}.jpg`,
        `${ad.ad_archive_id}.png`
      );
    }
    for (const k of keys) {
      if (!k) continue;
      const base = String(k).split('/').pop();
      if (base) referencedBasenames.add(base);
    }
  }

  // For each configured bucket, list objects and delete those whose basename is not referenced
  const storageOrphans = {};
  for (const bucketName of buckets) {
    if (preserveBuckets.includes(bucketName)) {
      if (opts.verbose) console.log(`${YELLOW}Preserve bucket skip:${RESET}`, bucketName);
      continue;
    }
    storageOrphans[bucketName] = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      try {
        const { data: listData, error: listErr } = await supabase.storage
          .from(bucketName)
          .list('', { limit: pageSize, offset });
        if (listErr) {
          console.warn(
            `${RED}Failed to list bucket${RESET}`,
            bucketName,
            listErr.message || listErr
          );
          break;
        }
        if (!listData || listData.length === 0) break;
        for (const obj of listData) {
          // obj.name is the object path
          const name = obj.name || obj.id || obj.path || null;
          if (!name) continue;
          const base = String(name).split('/').pop();
          if (!referencedBasenames.has(base)) {
            storageOrphans[bucketName].push(name);
          } else if (opts.verbose) {
            console.log(`${GREEN}Referenced (keep):${RESET}`, bucketName, name);
          }
        }
        if (listData.length < pageSize) break;
        offset += pageSize;
      } catch (e) {
        console.warn(
          `${RED}Exception listing bucket${RESET}`,
          bucketName,
          e && e.message ? e.message : e
        );
        break;
      }
    }
  }

  // Report storage orphan counts
  for (const [b, arr] of Object.entries(storageOrphans)) {
    if (!arr || arr.length === 0) continue;
    console.log(`${YELLOW}Bucket${RESET}`, b, `${YELLOW}orphan objects:${RESET}`, arr.length);
    if (opts.verbose) console.log('  sample:', arr.slice(0, 20));
  }

  // Remove storage orphan objects (honor dry-run and confirmation)
  if (!opts.dryRun) {
    if (!opts.yes && !process.env.CLEANUP_FORCE) {
      console.log(
        'Not removing storage-orphan objects because confirmation missing. Re-run with --yes or set CLEANUP_FORCE=1 to confirm.'
      );
    } else {
      for (const [bucketName, keys] of Object.entries(storageOrphans)) {
        if (!keys || keys.length === 0) continue;
        // remove in batches
        const batch = 100;
        for (let i = 0; i < keys.length; i += batch) {
          const slice = keys.slice(i, i + batch);
          try {
            const { error: remErr } = await supabase.storage.from(bucketName).remove(slice);
            if (remErr)
              console.warn(
                `${RED}Failed to remove objects from${RESET}`,
                bucketName,
                slice,
                remErr.message || remErr
              );
            else console.log(`${GREEN}Removed${RESET}`, slice.length, 'objects from', bucketName);
          } catch (e) {
            console.warn(
              `${RED}Exception removing objects from${RESET}`,
              bucketName,
              e && e.message ? e.message : e
            );
          }
        }
      }
    }
  } else {
    console.log(
      'Dry-run: no storage objects were deleted. Use --yes or set CLEANUP_FORCE=1 to delete.'
    );
  }

  const { error: delError } = await supabase.from('ads_library').delete().in('id', toDelete);
  if (delError) {
    console.error('Failed to delete ads:', delError.message || delError);
    process.exit(3);
  }

  console.log(`${RED}Deleted${RESET}`, toDelete.length, 'ads');
}

main().catch((e) => {
  console.error('Unexpected error', e);
  process.exit(99);
});
