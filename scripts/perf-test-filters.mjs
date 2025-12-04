#!/usr/bin/env node
// Quick perf test for filter/count/group logic (simulates ~10k ads)
// Usage: node scripts\perf-test-filters.mjs [--n=10000]

import { performance } from 'perf_hooks';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(arr, k = 1) {
  const out = [];
  for (let i = 0; i < k; i++) out.push(arr[Math.floor(Math.random() * arr.length)]);
  return out;
}

function normalizeHex(h) {
  if (!h || typeof h !== 'string') return null;
  let s = h.trim();
  if (s.startsWith('0x') || s.startsWith('0X')) s = s.slice(2);
  s = s.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (s.length === 0) return null;
  return s;
}

function hexToBitArray(hex, targetBits) {
  const n = normalizeHex(hex) || '';
  const bits = [];
  for (let i = 0; i < n.length; i++) {
    const byte = parseInt(n[i], 16);
    for (let b = 3; b >= 0; b--) bits.push((byte >> b) & 1);
  }
  if (typeof targetBits === 'number' && bits.length < targetBits) {
    const pad = new Array(targetBits - bits.length).fill(0);
    return pad.concat(bits);
  }
  return bits;
}

function hammingDistanceHex(a, b) {
  const na = normalizeHex(a) || '';
  const nb = normalizeHex(b) || '';
  if (na.length === 0 || nb.length === 0) return Infinity;
  const bitsA = hexToBitArray(na);
  const bitsB = hexToBitArray(nb, bitsA.length);
  let diff = 0;
  for (let i = 0; i < bitsA.length; i++) if ((bitsA[i] || 0) !== (bitsB[i] || 0)) diff++;
  return diff;
}

function buildPhashClustersFromKeys(phashKeys, groupMap, threshold) {
  const keyIndex = new Map();
  phashKeys.forEach((k, i) => keyIndex.set(k, i));
  const n = phashKeys.length;
  const parent = new Array(n).fill(0).map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent[rb] = ra;
  };
  for (let i = 0; i < n; i++) {
    const ki = phashKeys[i];
    const hexA = ki.slice(6);
    for (let j = i + 1; j < n; j++) {
      const kj = phashKeys[j];
      const hexB = kj.slice(6);
      const dist = hammingDistanceHex(hexA, hexB);
      if (Number.isFinite(dist) && dist <= threshold) union(i, j);
    }
  }
  const compMap = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = compMap.get(r) ?? [];
    arr.push(phashKeys[i]);
    compMap.set(r, arr);
  }
  const phashClusters = new Map();
  for (const keys of compMap.values()) phashClusters.set(keys[0], keys);
  const keyToRep = new Map();
  for (const [rep, keys] of phashClusters.entries()) for (const k of keys) keyToRep.set(k, rep);
  const repSize = new Map();
  for (const [rep, keys] of phashClusters.entries()) {
    let s = 0;
    for (const kk of keys) s += (groupMap.get(kk) || []).length;
    repSize.set(rep, s);
  }
  return { phashClusters, keyToRep, repSize };
}

function getGroupingKey(ad) {
  const phash = ad.creative_phash || ad.creative_hash || null;
  if (phash && String(phash).trim() !== '') return `phash:${String(phash).trim()}`;
  const imageKey = ad.image_url ? ad.image_url.split('/').slice(0, -1).join('/') : 'no-image';
  const rawText = ad.text || ad.title || '';
  const textKey = rawText ? rawText.substring(0, 100).replace(/\s+/g, ' ').trim() : 'no-text';
  return `${imageKey}|${textKey}`;
}

function extractFunnelsFromAd(ad) {
  const set = new Set();
  const addUrl = (raw) => {
    if (!raw) return;
    try {
      const str = String(raw);
      const urlRe = /https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+/gi;
      const matches = str.match(urlRe) || (str.includes('/') ? [str] : []);
      for (const m of matches) {
        try {
          const u = new URL(m);
          const hostAndPath = (u.host + u.pathname).replace(/\/+$/, '').toLowerCase();
          set.add(hostAndPath);
          if (u.pathname && u.pathname !== '/') set.add(u.pathname.toLowerCase());
        } catch (e) {
          const cleaned = String(m).replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
          if (cleaned) set.add('/' + cleaned);
        }
      }
    } catch (e) {}
  };
  addUrl(ad.link_url);
  addUrl(ad.meta_ad_url);
  if (ad.duplicates_links) addUrl(ad.duplicates_links);
  if (ad.text) addUrl(ad.text);
  return Array.from(set);
}

function makeRandomAds(n = 10000) {
  const pages = ['store-a', 'store-b', 'brand-x', 'brand-y', 'promo'];
  const platforms = ['facebook', 'instagram', 'tiktok'];
  const ctas = ['Shop now', 'Sign up', 'Learn more', 'Buy'];
  const formats = ['VIDEO', 'IMAGE', 'CAROUSEL'];
  const concepts = ['one_person', 'two_people', 'product_shot'];
  const realizations = ['stylized', 'real_life'];
  const topics = ['fitness', 'food', 'finance'];
  const hooks = ['shock', 'question', 'benefit'];
  const characters = ['male', 'female', 'none'];

  // Create pool of funnels
  const funnelPool = [];
  for (let i = 0; i < 500; i++) funnelPool.push(`example${i}.com/flow/${i}`);

  const ads = [];
  for (let i = 0; i < n; i++) {
    const id = i + 1;
    const fcount = randInt(0, 3);
    const funnels = [];
    for (let j = 0; j < fcount; j++) funnels.push(funnelPool[randInt(0, funnelPool.length - 1)]);
    const ad = {
      id: String(id),
      created_at: new Date(Date.now() - randInt(0, 365) * 24 * 3600 * 1000).toISOString(),
      ad_archive_id: String(100000 + id),
      page_name: pages[randInt(0, pages.length - 1)],
      text: `Ad text ${id} ${Math.random() > 0.95 ? 'quiz' : ''}`,
      title: `Title ${id}`,
      image_url: `https://cdn.example.com/images/${randInt(1, 2000)}.jpg`,
      publisher_platform: platforms[randInt(0, platforms.length - 1)],
      cta_type: ctas[randInt(0, ctas.length - 1)],
      display_format: formats[randInt(0, formats.length - 1)],
      concept: concepts[randInt(0, concepts.length - 1)],
      realisation: realizations[randInt(0, realizations.length - 1)],
      topic: topics[randInt(0, topics.length - 1)],
      hook: hooks[randInt(0, hooks.length - 1)],
      character: characters[randInt(0, characters.length - 1)],
      link_url: funnels.length ? `https://${funnels[0]}` : null,
      meta_ad_url: funnels.length > 1 ? `https://${funnels[1]}` : null,
      duplicates_links: funnels.length > 2 ? funnels.slice(2).join(';') : null,
      creative_phash: Math.random() > 0.9 ? Math.floor(Math.random() * 1e8).toString(16) : null,
    };
    ads.push(ad);
  }
  return ads;
}

function computeCounts(opts, filters, sourceAds) {
  const compute = (values, key) => {
    const out = {};
    for (const v of values) {
      let subset = sourceAds.slice();
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        subset = subset.filter(
          (ad) =>
            (ad.title || '').toLowerCase().includes(q) ||
            (ad.text || '').toLowerCase().includes(q) ||
            (ad.page_name || '').toLowerCase().includes(q)
        );
      }
      if (filters.pageName) subset = subset.filter((ad) => ad.page_name === filters.pageName);
      if (filters.publisherPlatform) {
        const wanted = filters.publisherPlatform.toLowerCase();
        subset = subset.filter((ad) =>
          (ad.publisher_platform || '')
            .toLowerCase()
            .split(',')
            .map((s) => s.trim())
            .includes(wanted)
        );
      }
      if (filters.ctaType) subset = subset.filter((ad) => ad.cta_type === filters.ctaType);
      if (filters.displayFormat)
        subset = subset.filter((ad) => ad.display_format === filters.displayFormat);
      if (filters.conceptFormat)
        subset = subset.filter((ad) => ad.concept === filters.conceptFormat);
      if (filters.realizationFormat)
        subset = subset.filter((ad) => ad.realisation === filters.realizationFormat);
      if (filters.topicFormat) subset = subset.filter((ad) => ad.topic === filters.topicFormat);
      if (filters.hookFormat) subset = subset.filter((ad) => ad.hook === filters.hookFormat);
      if (filters.characterFormat)
        subset = subset.filter((ad) => ad.character === filters.characterFormat);
      // funnels handled by filters.funnels externally
      out[v] = subset.length;
    }
    return out;
  };
  return {
    pageNames: compute(opts.pageNames, 'pageName'),
    publisherPlatforms: compute(opts.publisherPlatforms, 'publisherPlatform'),
    ctaTypes: compute(opts.ctaTypes, 'ctaType'),
    displayFormats: compute(opts.displayFormats, 'displayFormat'),
    conceptFormats: compute(opts.conceptFormats, 'conceptFormat'),
    realizationFormats: compute(opts.realizationFormats, 'realizationFormat'),
    topicFormats: compute(opts.topicFormats, 'topicFormat'),
    hookFormats: compute(opts.hookFormats, 'hookFormat'),
    characterFormats: compute(opts.characterFormats, 'characterFormat'),
    variationCounts: compute(opts.variationBuckets || [], 'variationCount'),
    funnels: compute(opts.funnels || [], 'funnels'),
  };
}

async function run() {
  const arg = process.argv.find((a) => a.startsWith('--n='));
  const n = arg ? Number(arg.split('=')[1]) : 10000;
  console.log(`Generating ${n} ads...`);
  const t0 = performance.now();
  const ads = makeRandomAds(n);
  const t1 = performance.now();
  console.log(`Generated ${ads.length} ads in ${(t1 - t0).toFixed(1)} ms`);

  // Build options from ads
  const pageNames = Array.from(new Set(ads.map((a) => a.page_name))).sort();
  const publisherPlatforms = Array.from(new Set(ads.map((a) => a.publisher_platform))).sort();
  const ctaTypes = Array.from(new Set(ads.map((a) => a.cta_type))).sort();
  const displayFormats = Array.from(new Set(ads.map((a) => a.display_format))).sort();
  const conceptFormats = Array.from(new Set(ads.map((a) => a.concept))).sort();
  const realizationFormats = Array.from(new Set(ads.map((a) => a.realisation))).sort();
  const topicFormats = Array.from(new Set(ads.map((a) => a.topic))).sort();
  const hookFormats = Array.from(new Set(ads.map((a) => a.hook))).sort();
  const characterFormats = Array.from(new Set(ads.map((a) => a.character))).sort();
  const variationBuckets = ['more_than_10', '5_10', '3_5', 'less_than_3'];

  // funnels pool extraction
  const adIdToFunnels = {};
  const funnelsSet = new Set();
  for (const ad of ads) {
    const fls = extractFunnelsFromAd(ad);
    adIdToFunnels[String(ad.id)] = fls;
    for (const f of fls) funnelsSet.add(f);
  }
  const funnels = Array.from(funnelsSet).slice(0, 1000).sort();

  const opts = {
    pageNames,
    publisherPlatforms,
    ctaTypes,
    displayFormats,
    conceptFormats,
    realizationFormats,
    topicFormats,
    hookFormats,
    characterFormats,
    variationBuckets,
    funnels,
  };

  // Warm up: run counts
  console.log('Running counts (warmup)...');
  let start = performance.now();
  const counts = computeCounts(opts, {}, ads);
  let end = performance.now();
  console.log(`Counts computed in ${(end - start).toFixed(1)} ms`);

  // Simulate applying some filters (search + funnels + pageName)
  const filters = {
    searchQuery: 'quiz',
    pageName: pageNames[randInt(0, pageNames.length - 1)],
    publisherPlatform: publisherPlatforms[randInt(0, publisherPlatforms.length - 1)],
    ctaType: '',
    displayFormat: '',
    conceptFormat: '',
    realizationFormat: '',
    topicFormat: '',
    hookFormat: '',
    characterFormat: '',
    dateRange: '',
    variationCount: '',
    funnels: funnels.length ? [funnels[0]] : [],
  };

  // Filtering performance
  console.log('Running filtering + grouping + sorting test...');
  start = performance.now();
  // apply same filtering pipeline as FilteredContainer
  let filtered = ads.slice();
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (ad) =>
        (ad.title || '').toLowerCase().includes(q) ||
        (ad.text || '').toLowerCase().includes(q) ||
        (ad.page_name || '').toLowerCase().includes(q)
    );
  }
  if (filters.pageName) filtered = filtered.filter((ad) => ad.page_name === filters.pageName);
  if (filters.publisherPlatform)
    filtered = filtered.filter((ad) =>
      (ad.publisher_platform || '').toLowerCase().includes(filters.publisherPlatform)
    );
  if (filters.funnels && filters.funnels.length > 0) {
    const sels = filters.funnels.map((s) => String(s).toLowerCase());
    filtered = filtered.filter((ad) => {
      const af = adIdToFunnels[String(ad.id)] || [];
      return sels.some((sv) => af.some((x) => String(x).includes(sv) || sv.includes(String(x))));
    });
  }

  // grouping
  const groupMap = new Map();
  for (const ad of filtered) {
    const k = getGroupingKey(ad);
    const arr = groupMap.get(k) ?? [];
    arr.push(ad);
    groupMap.set(k, arr);
  }
  const phashKeys = Array.from(groupMap.keys()).filter((k) => String(k).startsWith('phash:'));
  const { keyToRep, repSize } = buildPhashClustersFromKeys(phashKeys, groupMap, 4);

  // compute related counts
  const adIdToRelatedCount = {};
  for (const ad of filtered) {
    const k = getGroupingKey(ad);
    const mapped = keyToRep.get(k) ?? k;
    let effectiveSize = 0;
    if (String(mapped).startsWith('phash:'))
      effectiveSize = repSize.get(mapped) ?? (groupMap.get(mapped) || []).length ?? 1;
    else effectiveSize = (groupMap.get(k) || []).length ?? 1;
    adIdToRelatedCount[ad.id] = Math.max(0, effectiveSize - 1);
  }

  // sort by most variations
  const deduped = [];
  const seen = new Set();
  for (const ad of filtered) {
    const k = getGroupingKey(ad);
    const mapped = keyToRep.get(k) ?? k;
    if (seen.has(mapped)) continue;
    const group = groupMap.get(k) ?? [ad];
    const rep = group
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    deduped.push(rep);
    seen.add(mapped);
  }
  deduped.sort((a, b) => (adIdToRelatedCount[b.id] || 0) - (adIdToRelatedCount[a.id] || 0));

  end = performance.now();
  console.log(
    `Filtering+grouping+sorting done in ${(end - start).toFixed(1)} ms — result size: ${
      filtered.length
    }, deduped: ${deduped.length}`
  );

  console.log('Sample top 5 deduped with variation counts:');
  for (let i = 0; i < Math.min(5, deduped.length); i++) {
    const a = deduped[i];
    console.log(
      i + 1,
      `id=${a.id}`,
      `page=${a.page_name}`,
      `variations=${adIdToRelatedCount[a.id] || 0}`
    );
  }
}

run().catch((err) => {
  console.error('Perf test error:', err);
  process.exit(1);
});
