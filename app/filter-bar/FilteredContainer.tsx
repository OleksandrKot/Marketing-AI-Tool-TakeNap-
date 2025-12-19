'use client';

import { useState, useEffect, useMemo } from 'react';
import { extractDataArray } from '@/lib/core/utils';
import { useToast } from '@/components/ui/toast';
import ResultsGrid from '@/app/ad-archive-browser/components/ResultsGrid';
import type { ViewMode } from '@/lib/core/types';
import FilterPanel from '@/app/filter-bar/components/FilterPanel';
import { getAds } from '@/app/actions';
import type { Ad } from '@/lib/core/types';

interface FilterOptions {
  pageName: string;
  publisherPlatform: string;
  ctaType: string;
  displayFormat: string;
  dateRange: string;
  searchQuery: string;
  conceptFormat: string;
  realizationFormat: string;
  topicFormat: string;
  hookFormat: string;
  characterFormat: string;
  variationCount?: string;
  funnels?: string[]; // multi-select
}

interface FilteredContainerProps {
  initialPageName?: string;
  initialFunnels?: string[];
}

type SortMode = 'auto' | 'most_variations' | 'least_variations' | 'newest';
type FunnelsMap = Record<string, string[]>;

/** -----------------------------
 *  Helpers (pure functions)
 *  ---------------------------- */

function normalizePlatforms(raw?: string | null) {
  return (raw || '')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function applyDateRangeFilter(ads: Ad[], dateRange: string) {
  if (!dateRange) return ads;

  const now = new Date();
  let startDate: Date;

  switch (dateRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(0);
  }

  return ads.filter((ad) => new Date(ad.created_at) >= startDate);
}

/**
 * Apply all non-variation filters.
 * IMPORTANT: funnels filter applies only when funnels.length > 0 (fix for "all zeros").
 */
function applyFilters(sourceAds: Ad[], filters: FilterOptions, adIdToFunnels: FunnelsMap): Ad[] {
  let out = sourceAds;

  // Search
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    out = out.filter(
      (ad) =>
        ad.title?.toLowerCase().includes(q) ||
        ad.text?.toLowerCase().includes(q) ||
        ad.page_name?.toLowerCase().includes(q)
    );
  }

  // Page name
  if (filters.pageName) {
    out = out.filter((ad) => ad.page_name === filters.pageName);
  }

  // Publisher platform
  if (filters.publisherPlatform) {
    const wanted = filters.publisherPlatform.toLowerCase();
    out = out.filter((ad) => normalizePlatforms(ad.publisher_platform).includes(wanted));
  }

  // Simple equals filters
  if (filters.ctaType) out = out.filter((ad) => ad.cta_type === filters.ctaType);
  if (filters.displayFormat) out = out.filter((ad) => ad.display_format === filters.displayFormat);
  if (filters.conceptFormat) out = out.filter((ad) => ad.concept === filters.conceptFormat);
  if (filters.realizationFormat)
    out = out.filter((ad) => ad.realisation === filters.realizationFormat);
  if (filters.topicFormat) out = out.filter((ad) => ad.topic === filters.topicFormat);
  if (filters.hookFormat) out = out.filter((ad) => ad.hook === filters.hookFormat);
  if (filters.characterFormat) out = out.filter((ad) => ad.character === filters.characterFormat);

  // Date range
  if (filters.dateRange) {
    out = applyDateRangeFilter(out, filters.dateRange);
  }

  // Funnels (OR multi-select) — FIX: only when length > 0
  if (filters.funnels && Array.isArray(filters.funnels) && filters.funnels.length > 0) {
    const sels = filters.funnels.map((s) => String(s).toLowerCase());
    out = out.filter((ad) => {
      const adFunnels = adIdToFunnels[String(ad.id)] || [];
      return sels.some((sv) =>
        adFunnels.some(
          (af) => String(af).toLowerCase().includes(sv) || sv.includes(String(af).toLowerCase())
        )
      );
    });
  }

  return out;
}

/**
 * Build DSU duplicate groups from subset using duplicates_links + id/ad_archive_id resolution.
 * Returns groups of ads.
 */
function buildDuplicateGroups(subset: Ad[]): Ad[][] {
  const n = subset.length;
  if (n === 0) return [];

  const idToIndex = new Map<number, number>();
  const archiveIdToIndex = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const a = subset[i];
    idToIndex.set(Number(a.id), i);
    if (a.ad_archive_id) archiveIdToIndex.set(String(a.ad_archive_id), i);
  }

  const parent = new Array<number>(n).fill(0).map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const tryResolveTokenToIndex = (token: string): number | null => {
    const t = String(token).trim();
    if (!t) return null;

    const asNum = Number(t);
    if (Number.isFinite(asNum) && idToIndex.has(asNum)) return idToIndex.get(asNum) ?? null;

    if (archiveIdToIndex.has(t)) return archiveIdToIndex.get(t) ?? null;

    // fallback: token contains archiveId
    for (const [aid, idx] of archiveIdToIndex.entries()) {
      if (t.includes(aid)) return idx;
    }
    return null;
  };

  for (let i = 0; i < n; i++) {
    const a = subset[i];
    const raw = a.duplicates_links ?? '';
    if (!raw || typeof raw !== 'string') continue;

    const parts = raw
      .split(/[,\n\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      const otherIdx = tryResolveTokenToIndex(p);
      if (otherIdx !== null && otherIdx !== undefined) union(i, otherIdx);
    }
  }

  const repToGroupIndex = new Map<number, number>();
  const groups: Ad[][] = [];

  for (let i = 0; i < n; i++) {
    const r = find(i);
    const gi = repToGroupIndex.get(r) ?? groups.length;
    if (!repToGroupIndex.has(r)) repToGroupIndex.set(r, gi);
    const arr = groups[gi] ?? [];
    arr.push(subset[i]);
    groups[gi] = arr;
  }

  return groups;
}

function matchesVariationBucket(groupSize: number, bucket: string) {
  const related = Math.max(0, groupSize - 1);
  switch (bucket) {
    case 'more_than_10':
      return related >= 11;
    case '5_10':
      return related >= 5 && related <= 10;
    case '3_5':
      return related >= 3 && related <= 5;
    case 'less_than_3':
      return related === 1 || related === 2;
    default:
      return false;
  }
}

function filterByVariationBucket(subset: Ad[], bucket: string): Ad[] {
  if (!bucket) return subset;
  const groups = buildDuplicateGroups(subset);
  const keepIds = new Set<number>();

  for (const g of groups) {
    if (matchesVariationBucket(g.length, bucket)) {
      for (const a of g) keepIds.add(Number(a.id));
    }
  }

  return subset.filter((ad) => keepIds.has(Number(ad.id)));
}

/**
 * Funnels extraction (from multiple ad fields)
 */
function extractFunnelsFromAd(ad: Ad): string[] {
  const set: Set<string> = new Set();

  const addUrl = (raw?: string | null) => {
    if (!raw) return;
    const str = String(raw);

    try {
      const urlRe = /https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+/gi;
      const matches = str.match(urlRe) || (str.includes('/') ? [str] : []);

      for (const m of matches) {
        try {
          const u = new URL(m);
          const hostAndPath = (u.host + u.pathname).replace(/\/+$/, '').toLowerCase();
          set.add(hostAndPath);
          if (u.pathname && u.pathname !== '/') set.add(u.pathname.toLowerCase());
        } catch {
          const cleaned = String(m).replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
          if (cleaned) set.add('/' + cleaned);
        }
      }
    } catch {
      // noop
    }
  };

  addUrl(ad.link_url);
  addUrl(ad.meta_ad_url as string | undefined);
  const dupLinks = (ad as unknown as { duplicates_links?: string }).duplicates_links;
  if (dupLinks) addUrl(dupLinks);
  if (ad.text) addUrl(ad.text);

  return Array.from(set);
}

/** -----------------------------
 *  Component
 *  ---------------------------- */

export default function FilteredContainer({
  initialPageName = '',
  initialFunnels,
}: FilteredContainerProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [filteredAds, setFilteredAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [availableOptions, setAvailableOptions] = useState({
    pageNames: [] as string[],
    publisherPlatforms: [] as string[],
    ctaTypes: [] as string[],
    displayFormats: [] as string[],
    conceptFormats: [] as string[],
    realizationFormats: [] as string[],
    topicFormats: [] as string[],
    hookFormats: [] as string[],
    characterFormats: [] as string[],
    variationBuckets: [] as string[],
    funnels: [] as string[],
  });

  const [availableCounts, setAvailableCounts] = useState(() => ({
    pageNames: {} as Record<string, number>,
    publisherPlatforms: {} as Record<string, number>,
    ctaTypes: {} as Record<string, number>,
    displayFormats: {} as Record<string, number>,
    conceptFormats: {} as Record<string, number>,
    realizationFormats: {} as Record<string, number>,
    topicFormats: {} as Record<string, number>,
    hookFormats: {} as Record<string, number>,
    characterFormats: {} as Record<string, number>,
    variationCounts: {} as Record<string, number>,
    funnels: {} as Record<string, number>,
  }));

  const [adIdToFunnels, setAdIdToFunnels] = useState<FunnelsMap>({});
  const [currentFilters, setCurrentFilters] = useState<FilterOptions | null>(null);

  // Default sort: most_variations
  const [userSortMode, setUserSortMode] = useState<SortMode>('most_variations');

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [resetFlash, setResetFlash] = useState(false);
  const { showToast } = useToast();

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = { ...(prev || {}) };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const downloadSelected = () => {
    const ids = Object.keys(selectedIds || {});
    if (!ids.length) {
      try {
        showToast({ message: 'Please select at least one creative to export.', type: 'error' });
      } catch {}
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/ads/export-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });

        if (!res.ok) {
          let errMsg = 'Failed to export CSV';
          try {
            const j = await res.json();
            if (j?.error) errMsg = String(j.error);
          } catch {}
          try {
            showToast({ message: errMsg, type: 'error' });
          } catch {}
          return;
        }

        const blob = await res.blob();
        const date = new Date().toISOString().slice(0, 10);

        const filters = currentFilters;
        const filtersEmpty =
          !filters ||
          Object.entries(filters).every(([k, v]) => {
            if (k === 'funnels') return !v || (Array.isArray(v) && v.length === 0);
            return v === '' || v === undefined || v === null;
          });

        const filename = filtersEmpty
          ? `creo_data_export_${date}.csv`
          : `creo_data_filtered_${date}.csv`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        try {
          showToast({ message: 'Selected creatives exported', type: 'success' });
        } catch {}

        setSelectionMode(false);
        setSelectedIds({});
      } catch {
        try {
          showToast({ message: 'Export failed', type: 'error' });
        } catch {}
      }
    })();
  };

  // Compute counts for UI options (single source of truth)
  const computeCountsForOptions = (
    opts: typeof availableOptions,
    filters: FilterOptions,
    sourceAds: Ad[],
    funnelsMap: FunnelsMap
  ) => {
    const countFor = (values: string[], key: keyof FilterOptions | 'variationCount') => {
      const out: Record<string, number> = {};

      for (const v of values) {
        const candidate: FilterOptions = { ...filters };

        if (key === 'funnels') {
          // count as if user selected ONLY this funnel (keeping other filters)
          candidate.funnels = [v];
        } else if (key === 'variationCount') {
          candidate.variationCount = v;
        } else {
          (candidate as unknown as Record<string, unknown>)[key as string] = v;
        }

        // 1) Apply all filters except variationCount
        const base = applyFilters(sourceAds, candidate, funnelsMap);

        // 2) Apply variation bucket if needed
        const final =
          candidate.variationCount && key !== 'variationCount'
            ? filterByVariationBucket(base, String(candidate.variationCount))
            : key === 'variationCount'
            ? filterByVariationBucket(base, String(v))
            : base;

        out[v] = final.length;
      }

      return out;
    };

    return {
      pageNames: countFor(opts.pageNames, 'pageName'),
      publisherPlatforms: countFor(opts.publisherPlatforms, 'publisherPlatform'),
      ctaTypes: countFor(opts.ctaTypes, 'ctaType'),
      displayFormats: countFor(opts.displayFormats, 'displayFormat'),
      conceptFormats: countFor(opts.conceptFormats, 'conceptFormat'),
      realizationFormats: countFor(opts.realizationFormats, 'realizationFormat'),
      topicFormats: countFor(opts.topicFormats, 'topicFormat'),
      hookFormats: countFor(opts.hookFormats, 'hookFormat'),
      characterFormats: countFor(opts.characterFormats, 'characterFormat'),
      variationCounts: countFor(opts.variationBuckets as string[], 'variationCount'),
      funnels: countFor(opts.funnels as string[], 'funnels'),
    };
  };

  useEffect(() => {
    const loadAds = async () => {
      try {
        const raw = await getAds();
        const allAds: Ad[] = extractDataArray<Ad>(raw);

        setAds(allAds);

        // Build options
        const pageNames = Array.from(
          new Set(allAds.map((ad) => ad.page_name).filter(Boolean))
        ).sort();

        const publisherPlatforms = Array.from(
          new Set(allAds.flatMap((ad) => normalizePlatforms(ad.publisher_platform)))
        ).sort();

        const ctaTypes = Array.from(
          new Set(allAds.map((ad) => ad.cta_type).filter(Boolean))
        ).sort();
        const displayFormats = Array.from(
          new Set(allAds.map((ad) => ad.display_format).filter(Boolean))
        ).sort();

        const conceptFormats = Array.from(
          new Set(
            allAds
              .map((ad) => ad.concept)
              .filter((x): x is string => x !== null && x !== undefined && x !== '')
          )
        ).sort();

        const realizationFormats = Array.from(
          new Set(
            allAds
              .map((ad) => ad.realisation)
              .filter((x): x is string => x !== null && x !== undefined && x !== '')
          )
        ).sort();

        const topicFormats = Array.from(
          new Set(
            allAds
              .map((ad) => ad.topic)
              .filter((x): x is string => x !== null && x !== undefined && x !== '')
          )
        ).sort();

        const hookFormats = Array.from(
          new Set(
            allAds
              .map((ad) => ad.hook)
              .filter((x): x is string => x !== null && x !== undefined && x !== '')
          )
        ).sort();

        const characterFormats = Array.from(
          new Set(
            allAds
              .map((ad) => ad.character)
              .filter((x): x is string => x !== null && x !== undefined && x !== '')
          )
        ).sort();

        const variationBuckets = ['more_than_10', '5_10', '3_5', 'less_than_3'];

        // Funnels: extract per ad
        const funnelsSet = new Set<string>();
        const adIdToFunnelsMap: FunnelsMap = {};
        for (const ad of allAds) {
          try {
            const fls = extractFunnelsFromAd(ad);
            adIdToFunnelsMap[String(ad.id)] = fls;
            for (const f of fls) funnelsSet.add(f);
          } catch {
            adIdToFunnelsMap[String(ad.id)] = [];
          }
        }
        const funnels = Array.from(funnelsSet).sort();

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

        setAvailableOptions(opts);
        setAdIdToFunnels(adIdToFunnelsMap);

        // Initial filtered ads
        const baseFiltered = initialPageName
          ? allAds.filter((ad) => ad.page_name === initialPageName)
          : allAds;

        setFilteredAds(baseFiltered);

        // Initial counts (IMPORTANT: funnels: [] must NOT filter everything)
        const emptyFilters: FilterOptions = {
          pageName: '',
          publisherPlatform: '',
          ctaType: '',
          displayFormat: '',
          dateRange: '',
          searchQuery: '',
          conceptFormat: '',
          realizationFormat: '',
          topicFormat: '',
          hookFormat: '',
          characterFormat: '',
          funnels: [], // safe now
        };

        const initialCounts = computeCountsForOptions(opts, emptyFilters, allAds, adIdToFunnelsMap);
        setAvailableCounts(initialCounts);

        // Apply initialFunnels if provided
        if (Array.isArray(initialFunnels) && initialFunnels.length > 0) {
          const preset: FilterOptions = {
            ...emptyFilters,
            funnels: initialFunnels,
          };
          handleFiltersChange(preset, allAds, opts, adIdToFunnelsMap);
        }
      } catch (error) {
        console.error('Error loading ads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * handleFiltersChange now uses the same applyFilters pipeline.
   * Optional params let us call it during initial load before state settles.
   */
  const handleFiltersChange = (
    filters: FilterOptions,
    adsArg: Ad[] = ads,
    optsArg: typeof availableOptions = availableOptions,
    funnelsMapArg: FunnelsMap = adIdToFunnels
  ) => {
    setCurrentFilters(filters);

    // counts for dropdowns
    try {
      const countsObj = computeCountsForOptions(optsArg, filters, adsArg, funnelsMapArg);
      setAvailableCounts(countsObj);
    } catch (e) {
      console.debug('Failed to compute availableCounts', e);
    }

    // apply filters
    let next = applyFilters(adsArg, filters, funnelsMapArg);

    // variation bucket filter
    if (filters.variationCount) {
      next = filterByVariationBucket(next, String(filters.variationCount));
    }

    // enforce auto sort
    setUserSortMode('most_variations');

    setFilteredAds(next);
  };

  // Grouping / dedupe for Advanced Filter results (based only on duplicates_links)
  const {
    dedupedAds: groupedDedupedAds,
    adIdToGroupMap: groupedAdIdToGroupMap,
    adIdToRelatedCount: groupedAdIdToRelatedCount,
  } = useMemo(() => {
    const subset = filteredAds;

    const groups = buildDuplicateGroups(subset);

    // map adId -> group
    const adIdToGroup: Record<string, Ad[]> = {};
    for (const g of groups) {
      for (const a of g) adIdToGroup[String(a.id)] = g;
    }

    // representative list: for groups >1 take newest; otherwise include itself
    const reps: Ad[] = [];
    const seenRep = new Set<string>();

    for (const g of groups) {
      if (g.length > 1) {
        const rep = g
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const key = String(rep?.id ?? '');
        if (key && !seenRep.has(key)) {
          reps.push(rep);
          seenRep.add(key);
        }
      } else {
        const only = g[0];
        const key = String(only?.id ?? '');
        if (key && !seenRep.has(key)) {
          reps.push(only);
          seenRep.add(key);
        }
      }
    }

    // related counts
    const relatedCount: Record<string, number> = {};
    for (const a of subset) {
      const size = adIdToGroup[String(a.id)]?.length ?? 1;
      relatedCount[String(a.id)] = Math.max(0, size - 1);
    }

    return {
      dedupedAds: reps,
      adIdToGroupMap: adIdToGroup,
      adIdToRelatedCount: relatedCount,
    };
  }, [filteredAds]);

  const sortedGroupedDedupedAds = useMemo(() => {
    const arr = [...groupedDedupedAds];
    const mode = userSortMode === 'auto' ? 'most_variations' : userSortMode;

    if (mode === 'most_variations') {
      return arr.sort((a, b) => {
        const na = groupedAdIdToRelatedCount[String(a.id)] ?? 0;
        const nb = groupedAdIdToRelatedCount[String(b.id)] ?? 0;
        if (nb !== na) return nb - na;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    if (mode === 'least_variations') {
      return arr.sort((a, b) => {
        const na = groupedAdIdToRelatedCount[String(a.id)] ?? 0;
        const nb = groupedAdIdToRelatedCount[String(b.id)] ?? 0;
        if (na !== nb) return na - nb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    // newest
    return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [groupedDedupedAds, groupedAdIdToRelatedCount, userSortMode]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FilterPanel
        onFiltersChange={handleFiltersChange}
        availableOptions={availableOptions}
        initialPageName={initialPageName}
        counts={availableCounts}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="totalAds mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Search Results</h3>
          <p className="text-slate-600">
            Found: <span className="font-semibold text-slate-900">{filteredAds.length}</span> ads
          </p>
          {selectionMode && (
            <div className="mt-2 text-sm text-slate-700">
              Selected:{' '}
              <span className="font-semibold text-slate-900">
                {Object.keys(selectedIds).length}
              </span>
            </div>
          )}
        </div>

        <div
          className={`flex items-center justify-between mb-4 ${
            resetFlash ? 'opacity-70 transition-opacity duration-300' : ''
          }`}
        >
          <div />
          <div className="flex items-center gap-3">
            <label htmlFor="filtered-sort" className="text-sm text-slate-600 mr-2">
              Sort:
            </label>
            <select
              id="filtered-sort"
              value={userSortMode}
              onChange={(e) => setUserSortMode(e.target.value as SortMode)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            >
              <option value="least_variations">Least variations</option>
              <option value="most_variations">Most variations</option>
              <option value="newest">Newest</option>
            </select>

            <div className="ml-3">
              <div className="flex items-center gap-2">
                {!selectionMode ? (
                  <button
                    type="button"
                    onClick={() => setSelectionMode(true)}
                    className="px-3 py-2 text-sm rounded-md border border-slate-200"
                    title="Enable selection mode"
                  >
                    Select to download creo data
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (Object.keys(selectedIds).length > 0) downloadSelected();
                        else {
                          try {
                            showToast({
                              message: 'Please select at least one creative to export.',
                              type: 'error',
                            });
                          } catch {}
                        }
                      }}
                      disabled={Object.keys(selectedIds).length === 0}
                      className={`px-3 py-2 text-sm rounded-md border ${
                        Object.keys(selectedIds).length === 0
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                          : 'bg-blue-600 text-white border-blue-600'
                      }`}
                    >
                      Download selected
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds({});
                        try {
                          showToast({ message: 'Selection cleared', type: 'success' });
                        } catch {}
                        setResetFlash(true);
                        setTimeout(() => setResetFlash(false), 260);
                      }}
                      className="px-3 py-2 text-sm rounded-md border bg-white text-slate-700 border-slate-200"
                    >
                      Reset selection
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const filters = currentFilters;
                        const filtersEmpty =
                          !filters ||
                          Object.entries(filters).every(([k, v]) => {
                            if (k === 'funnels') return !v || (Array.isArray(v) && v.length === 0);
                            return v === '' || v === undefined || v === null;
                          });

                        const targetAds = filtersEmpty ? ads : filteredAds;
                        const next: Record<string, boolean> = {};
                        for (const a of targetAds) next[String(a.id)] = true;
                        setSelectedIds(next);

                        try {
                          showToast({
                            message: `Selected ${Object.keys(next).length} creatives`,
                            type: 'success',
                          });
                        } catch {}
                      }}
                      className="px-3 py-2 text-sm rounded-md border bg-slate-50 hover:bg-slate-100 border-slate-200"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedIds({});
                        try {
                          showToast({ message: 'Exited selection mode', type: 'success' });
                        } catch {}
                      }}
                      className="px-3 py-2 text-sm rounded-md border bg-white text-slate-700 border-slate-200"
                    >
                      Exit selection
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <ResultsGrid
          isLoading={isLoading}
          showAINewsModal={false}
          processingMessage={''}
          viewMode={'grid' as ViewMode}
          currentPageAds={sortedGroupedDedupedAds}
          adIdToGroupMap={groupedAdIdToGroupMap}
          adIdToRelatedCount={groupedAdIdToRelatedCount}
          filteredAdsByType={filteredAds}
          selectedCreativeType={'all'}
          processingDone={false}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectId}
        />
      </div>
    </div>
  );
}
