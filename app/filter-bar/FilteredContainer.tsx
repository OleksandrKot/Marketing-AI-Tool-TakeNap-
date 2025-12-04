'use client';

import { useState, useEffect, useMemo } from 'react';
import { extractDataArray } from '@/lib/core/utils';
import { useToast } from '@/components/ui/toast';
import * as archiveUtils from '@/app/ad-archive-browser/utils';
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
  funnels?: string[]; // selected funnels (multi)
}

interface FilteredContainerProps {
  initialPageName?: string;
  initialFunnels?: string[];
}

type SortMode = 'auto' | 'most_variations' | 'least_variations' | 'newest';

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
  const [adIdToFunnels, setAdIdToFunnels] = useState<Record<string, string[]>>({});
  const [currentFilters, setCurrentFilters] = useState<FilterOptions | null>(null);
  // Auto-sort mode: default to 'most_variations' so filtered results are
  // automatically ordered from most -> least variations per AC1.
  const [userSortMode, setUserSortMode] = useState<
    'auto' | 'most_variations' | 'least_variations' | 'newest'
  >('most_variations');
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
    // manual toggle cancels universal select-all state
  };

  // helper removed: unused and triggered lint "no-unused-vars"

  const extractFunnelsFromAd = (ad: Ad) => {
    const set: Set<string> = new Set();
    const addUrl = (raw?: string | null) => {
      if (!raw) return;
      const str = String(raw);
      // find urls
      try {
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
      } catch (e) {
        // noop
      }
    };

    addUrl(ad.link_url);
    addUrl(ad.meta_ad_url as string | undefined);
    const dupLinks = (ad as unknown as { duplicates_links?: string }).duplicates_links;
    if (dupLinks) addUrl(dupLinks);
    if (ad.text) addUrl(ad.text);
    return Array.from(set);
  };

  const downloadSelected = () => {
    const ids = Object.keys(selectedIds || {});
    if (!ids.length) {
      try {
        showToast({ message: 'Please select at least one creative to export.', type: 'error' });
      } catch (e) {}
      return;
    }

    (async () => {
      try {
        console.log('[FilteredContainer] downloadSelected ids=', ids);
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
          } catch (e) {
            // noop
          }
          try {
            showToast({ message: errMsg, type: 'error' });
          } catch (e) {}
          return;
        }

        const blob = await res.blob();

        // Build filename locally depending on whether filters are applied
        const date = new Date().toISOString().slice(0, 10);
        const filters = currentFilters;
        const filtersEmpty =
          !filters ||
          Object.values(filters).every((v) => v === '' || v === undefined || v === null);
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
        } catch (e) {}

        setSelectionMode(false);
        setSelectedIds({});
      } catch (e) {
        try {
          showToast({ message: 'Export failed', type: 'error' });
        } catch (err) {}
      }
    })();
  };

  useEffect(() => {
    const loadAds = async () => {
      try {
        const raw = await getAds();
        const allAds: Ad[] = extractDataArray<Ad>(raw);
        setAds(allAds);

        const pageNames = Array.from(
          new Set(allAds.map((ad) => ad.page_name).filter(Boolean))
        ).sort();
        const publisherPlatforms = Array.from(
          new Set(
            allAds
              .map((ad) => ad.publisher_platform || '')
              .flatMap((str) =>
                str
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
              .map((s) => s.toLowerCase())
          )
        ).sort();
        const ctaTypes = Array.from(
          new Set(allAds.map((ad) => ad.cta_type).filter(Boolean))
        ).sort();
        const displayFormats = Array.from(
          new Set(allAds.map((ad) => ad.display_format).filter(Boolean))
        ).sort();
        const conceptFormats = Array.from(
          new Set(allAds.map((ad) => ad.concept).filter((item): item is string => item !== null))
        ).sort();
        const realizationFormats = Array.from(
          new Set(
            allAds.map((ad) => ad.realisation).filter((item): item is string => item !== null)
          )
        ).sort();
        const topicFormats = Array.from(
          new Set(allAds.map((ad) => ad.topic).filter((item): item is string => item !== null))
        ).sort();
        const hookFormats = Array.from(
          new Set(allAds.map((ad) => ad.hook).filter((item): item is string => item !== null))
        ).sort();
        const characterFormats = Array.from(
          new Set(allAds.map((ad) => ad.character).filter((item): item is string => item !== null))
        ).sort();
        // Extract funnels from ads
        const funnelsSet = new Set<string>();
        const adIdToFunnelsMap: Record<string, string[]> = {};
        for (const ad of allAds) {
          try {
            const fls = extractFunnelsFromAd(ad);
            adIdToFunnelsMap[String(ad.id)] = fls;
            for (const f of fls) funnelsSet.add(f);
          } catch (e) {
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
          variationBuckets: ['more_than_10', '5_10', '3_5', 'less_than_3'],
          funnels,
        };
        setAvailableOptions(opts);
        setAdIdToFunnels(adIdToFunnelsMap);
        // Apply initial page filter if present
        if (initialPageName) {
          const filteredByPage = allAds.filter((ad) => ad.page_name === initialPageName);
          setFilteredAds(filteredByPage);
        } else {
          setFilteredAds(allAds);
        }

        // Initialize counts based on the full dataset (no filters)
        try {
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
            funnels: [],
          };
          const initialCounts = computeCountsForOptions(
            opts,
            emptyFilters,
            allAds,
            adIdToFunnelsMap
          );
          setAvailableCounts(initialCounts);
          // If the page was opened with an initial funnels param, apply it now
          try {
            const rawFunnels = (initialFunnels ?? []) as string[];
            if (Array.isArray(rawFunnels) && rawFunnels.length > 0) {
              const presetFilters: FilterOptions = {
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
                funnels: rawFunnels,
              };
              // apply filters as if user selected funnels in the UI
              handleFiltersChange(presetFilters);
            }
          } catch (e) {
            /* noop */
          }
        } catch (e) {
          console.debug('Failed to initialize availableCounts', e);
        }
      } catch (error) {
        console.error('Error loading ads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAds();
  }, []);

  // Reusable counts computation function that operates on given option lists and a filters object.
  const computeCountsForOptions = (
    opts: typeof availableOptions,
    filters: FilterOptions,
    sourceAds: Ad[] = ads,
    // allow passing a precomputed adId->funnels map so initial counts
    // can be computed synchronously before state updates propagate
    adIdToFunnelsArg?: Record<string, string[]>
  ) => {
    const compute = (values: string[], key: keyof FilterOptions | 'variationCount') => {
      const out: Record<string, number> = {};
      for (const v of values) {
        let candidate: FilterOptions;
        if (key === 'funnels') {
          candidate = { ...filters, funnels: [v] } as FilterOptions;
        } else {
          candidate = { ...filters, [key]: v } as FilterOptions;
        }
        let subset = [...sourceAds];

        if (candidate.searchQuery) {
          const q = candidate.searchQuery.toLowerCase();
          subset = subset.filter(
            (ad) =>
              ad.title?.toLowerCase().includes(q) ||
              ad.text?.toLowerCase().includes(q) ||
              ad.page_name?.toLowerCase().includes(q)
          );
        }

        if (candidate.pageName) subset = subset.filter((ad) => ad.page_name === candidate.pageName);

        if (candidate.publisherPlatform) {
          const wanted = candidate.publisherPlatform.toLowerCase();
          subset = subset.filter((ad) => {
            const platforms = (ad.publisher_platform || '')
              .split(',')
              .map((p) => p.trim().toLowerCase())
              .filter(Boolean);
            return platforms.includes(wanted);
          });
        }

        if (candidate.ctaType) subset = subset.filter((ad) => ad.cta_type === candidate.ctaType);
        if (candidate.displayFormat)
          subset = subset.filter((ad) => ad.display_format === candidate.displayFormat);
        if (candidate.conceptFormat)
          subset = subset.filter((ad) => ad.concept === candidate.conceptFormat);
        if (candidate.realizationFormat)
          subset = subset.filter((ad) => ad.realisation === candidate.realizationFormat);
        if (candidate.topicFormat)
          subset = subset.filter((ad) => ad.topic === candidate.topicFormat);
        if (candidate.hookFormat) subset = subset.filter((ad) => ad.hook === candidate.hookFormat);
        if (candidate.characterFormat)
          subset = subset.filter((ad) => ad.character === candidate.characterFormat);

        // Funnels: candidate.funnels is array of selected funnel strings
        if (candidate.funnels && Array.isArray(candidate.funnels)) {
          const sel: string[] = candidate.funnels.map((s: string) => String(s).toLowerCase());
          const funnelsMap = adIdToFunnelsArg ?? adIdToFunnels;
          subset = subset.filter((ad) => {
            const adFunnels = funnelsMap[String(ad.id)] || [];
            return sel.some((sv) =>
              adFunnels.some((af) => String(af).includes(sv) || sv.includes(String(af)))
            );
          });
        }

        if (candidate.dateRange) {
          const now = new Date();
          let startDate: Date;
          switch (candidate.dateRange) {
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
          subset = subset.filter((ad) => new Date(ad.created_at) >= startDate);
        }

        // Special handling for variation-count buckets
        if ((key as string) === 'variationCount') {
          try {
            // Build grouping (same logic as archive grouping)
            const groupMap = new Map<string, Ad[]>();
            for (const ad of subset) {
              const k = archiveUtils.getGroupingKey(ad);
              const arr = groupMap.get(k) ?? [];
              arr.push(ad);
              groupMap.set(k, arr);
            }

            const phashKeys = Array.from(groupMap.keys()).filter((k) =>
              String(k).startsWith('phash:')
            );
            const { keyToRep, repSize } = archiveUtils.buildPhashClustersFromKeys(
              phashKeys,
              groupMap,
              4
            );

            let matchCount = 0;
            for (const ad of subset) {
              const k = archiveUtils.getGroupingKey(ad);
              const mapped = keyToRep.get(k) ?? k;
              let effectiveSize = 0;
              if (String(mapped).startsWith('phash:')) {
                effectiveSize = repSize.get(mapped) ?? groupMap.get(mapped)?.length ?? 1;
              } else {
                effectiveSize = groupMap.get(k)?.length ?? 1;
              }
              const related = Math.max(0, effectiveSize - 1);

              const bucket = String(v);
              let matched = false;
              switch (bucket) {
                case 'more_than_10':
                  matched = related >= 11;
                  break;
                case '5_10':
                  matched = related >= 5 && related <= 10;
                  break;
                case '3_5':
                  matched = related >= 3 && related <= 5;
                  break;
                case 'less_than_3':
                  matched = related === 1 || related === 2;
                  break;
                default:
                  matched = false;
              }
              if (matched) matchCount++;
            }
            out[v] = matchCount;
          } catch (e) {
            out[v] = 0;
          }
        } else {
          out[v] = subset.length;
        }
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
      variationCounts: compute(opts.variationBuckets as string[], 'variationCount'),
      funnels: compute(opts.funnels as string[], 'funnels'),
    };
  };

  const handleFiltersChange = (filters: FilterOptions) => {
    setCurrentFilters(filters);
    try {
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.debug('[FilteredContainer] handleFiltersChange incomingFilters=', filters);
      }
    } catch (e) {}
    // store current filters so counts can be computed

    // compute counts for every option based on current filters
    try {
      const countsObj = computeCountsForOptions(availableOptions, filters, ads);
      setAvailableCounts(countsObj);
      try {
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line no-console
          console.debug('[FilteredContainer] computed availableCounts summary=', {
            pageNames: Object.keys(countsObj.pageNames).length,
            variationCountsSample: countsObj.variationCounts,
          });
        }
      } catch (e) {
        /* noop */
      }
    } catch (e) {
      console.debug('Failed to compute availableCounts', e);
    }

    let filtered = [...ads];

    // Фільтр пошуку
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ad) =>
          ad.title?.toLowerCase().includes(query) ||
          ad.text?.toLowerCase().includes(query) ||
          ad.page_name?.toLowerCase().includes(query)
      );
    }

    // Фільтр назви сторінки
    if (filters.pageName) {
      filtered = filtered.filter((ad) => ad.page_name === filters.pageName);
    }

    // Фільтр платформи: ad.publisher_platform may be a comma-separated string, so split and match
    if (filters.publisherPlatform) {
      const wanted = filters.publisherPlatform.toLowerCase();
      filtered = filtered.filter((ad) => {
        const platforms = (ad.publisher_platform || '')
          .split(',')
          .map((p) => p.trim().toLowerCase())
          .filter(Boolean);
        return platforms.includes(wanted);
      });
    }
    // Фільтр типу CTA
    if (filters.ctaType) {
      filtered = filtered.filter((ad) => ad.cta_type === filters.ctaType);
    }

    // Фільтр формату відображення
    if (filters.displayFormat) {
      filtered = filtered.filter((ad) => ad.display_format === filters.displayFormat);
    }

    // Фільтр концепції
    if (filters.conceptFormat) {
      filtered = filtered.filter((ad) => ad.concept === filters.conceptFormat);
    }
    // Фільтр реалізації
    if (filters.realizationFormat) {
      filtered = filtered.filter((ad) => ad.realisation === filters.realizationFormat);
    }
    // Фільтр теми
    if (filters.topicFormat) {
      filtered = filtered.filter((ad) => ad.topic === filters.topicFormat);
    }
    // Фільтр хука
    if (filters.hookFormat) {
      filtered = filtered.filter((ad) => ad.hook === filters.hookFormat);
    }
    // Фільтр персонажа
    if (filters.characterFormat) {
      filtered = filtered.filter((ad) => ad.character === filters.characterFormat);
    }

    // Фільтр дати
    if (filters.dateRange) {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateRange) {
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

      filtered = filtered.filter((ad) => {
        const adDate = new Date(ad.created_at);
        return adDate >= startDate;
      });
    }

    // Funnels filter (multi-select OR)
    if (filters.funnels && Array.isArray(filters.funnels) && filters.funnels.length > 0) {
      const sels = filters.funnels.map((s) => String(s).toLowerCase());
      filtered = filtered.filter((ad) => {
        const adFunnels = adIdToFunnels[String(ad.id)] || [];
        return sels.some((sv) =>
          adFunnels.some((af) => String(af).includes(sv) || sv.includes(String(af)))
        );
      });
    }

    // Variation-count bucket filter (grouping-based)
    if (filters.variationCount) {
      try {
        const groupMap = new Map<string, Ad[]>();
        for (const ad of filtered) {
          const k = archiveUtils.getGroupingKey(ad);
          const arr = groupMap.get(k) ?? [];
          arr.push(ad);
          groupMap.set(k, arr);
        }

        const phashKeys = Array.from(groupMap.keys()).filter((k) => String(k).startsWith('phash:'));
        const { keyToRep, repSize } = archiveUtils.buildPhashClustersFromKeys(
          phashKeys,
          groupMap as Map<string, Ad[]>,
          4
        );

        const bucket = String(filters.variationCount);
        filtered = filtered.filter((ad) => {
          const k = archiveUtils.getGroupingKey(ad);
          const mapped = keyToRep.get(k) ?? k;
          let effectiveSize = 0;
          if (String(mapped).startsWith('phash:')) {
            effectiveSize = repSize.get(mapped) ?? groupMap.get(mapped)?.length ?? 1;
          } else {
            effectiveSize = groupMap.get(k)?.length ?? 1;
          }
          const related = Math.max(0, effectiveSize - 1);

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
              return true;
          }
        });
      } catch (e) {
        // if anything fails, keep the current filtered set (fail-open)
        console.debug('variationCount filter failed', e);
      }
    }

    // Ensure automatic sorting is applied after filters change (AC1/AC2/AC3)
    try {
      setUserSortMode('most_variations');
    } catch (e) {
      /* noop */
    }

    try {
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.debug(
          '[FilteredContainer] filtered length=',
          filtered.length,
          'sampleIds=',
          filtered.slice(0, 8).map((a) => a.id)
        );
      }
    } catch (e) {
      /* noop */
    }

    setFilteredAds(filtered);
  };

  // Compute grouping/deduping similarly to main Ad Archive so Advanced Filter
  // shows the same grouped representatives. We adjust the collapse threshold
  // when filters are active to produce a "smarter" grouping (less aggressive
  // collapse) so that sorting / filtered views don't hide important variants.
  const {
    dedupedAds: groupedDedupedAds,
    adIdToGroupMap: groupedAdIdToGroupMap,
    adIdToRelatedCount: groupedAdIdToRelatedCount,
  } = useMemo(() => {
    const filteredAdsByType = filteredAds;

    const groupMap = new Map<string, typeof filteredAdsByType>();
    for (const ad of filteredAdsByType) {
      const key = archiveUtils.getGroupingKey(ad);
      const arr = groupMap.get(key) ?? [];
      arr.push(ad);
      groupMap.set(key, arr);
    }

    const phashKeys = Array.from(groupMap.keys()).filter((k) => String(k).startsWith('phash:'));

    const PHASH_GROUP_COLLAPSE_THRESHOLD_LOCAL = currentFilters ? 3 : 2;
    const PHASH_GROUP_MAX_COLLAPSE_LOCAL = 15;
    const PHASH_HAMMING_THRESHOLD_LOCAL = 4;

    const { phashClusters, keyToRep } = archiveUtils.buildPhashClustersFromKeys(
      phashKeys,
      groupMap as Map<string, Ad[]>,
      PHASH_HAMMING_THRESHOLD_LOCAL
    );

    const seenGroup = new Set<string>();
    const out: typeof filteredAdsByType = [];
    for (const ad of filteredAdsByType) {
      const key = archiveUtils.getGroupingKey(ad);
      const mapped = keyToRep.get(key) ?? key;
      if (seenGroup.has(mapped)) continue;
      const group = groupMap.get(key) ?? [ad];

      let effectiveSize = group.length;
      if (mapped !== key) {
        const keysInCluster = phashClusters.get(mapped) ?? [];
        effectiveSize = keysInCluster.reduce((sum, kk) => sum + (groupMap.get(kk)?.length ?? 0), 0);
      }

      const isPhashBased = String(mapped).startsWith('phash:');
      const shouldCollapse = isPhashBased
        ? effectiveSize >= PHASH_GROUP_COLLAPSE_THRESHOLD_LOCAL &&
          effectiveSize <= PHASH_GROUP_MAX_COLLAPSE_LOCAL
        : group.length > 1;

      if (shouldCollapse) {
        const rep = group.slice().sort((a, b) => {
          const da = new Date(a.created_at).getTime();
          const db = new Date(b.created_at).getTime();
          return db - da;
        })[0];
        if (rep) out.push(rep);
      } else {
        out.push(...group);
      }
      seenGroup.add(mapped);
    }

    const adIdToGroupMapOut: Record<string, typeof filteredAdsByType> = {};
    groupMap.forEach((grp) => {
      for (const a of grp) adIdToGroupMapOut[a.id] = grp;
    });

    // compute related counts
    const { keyToRep: keyToRep2, repSize } = archiveUtils.buildPhashClustersFromKeys(
      phashKeys,
      groupMap as Map<string, Ad[]>,
      PHASH_HAMMING_THRESHOLD_LOCAL
    );
    const adIdToRelatedCountOut: Record<string, number> = {};
    for (const ad of filteredAdsByType) {
      const key = archiveUtils.getGroupingKey(ad);
      const mapped = keyToRep2.get(key) ?? key;
      let effectiveSize = 0;
      if (String(mapped).startsWith('phash:')) {
        effectiveSize = repSize.get(mapped) ?? groupMap.get(mapped)?.length ?? 1;
      } else {
        effectiveSize = groupMap.get(key)?.length ?? 1;
      }
      adIdToRelatedCountOut[ad.id] = Math.max(0, effectiveSize - 1);
    }

    return {
      dedupedAds: out,
      adIdToGroupMap: adIdToGroupMapOut,
      adIdToRelatedCount: adIdToRelatedCountOut,
    };
  }, [filteredAds, currentFilters]);

  // Local sort mode for Advanced Filter results. (state declared above)

  const sortedGroupedDedupedAds = useMemo(() => {
    try {
      const arr = [...groupedDedupedAds];
      const effectiveMode = (() => {
        if (userSortMode === 'auto') return 'most_variations';
        return userSortMode;
      })();

      if (effectiveMode === 'most_variations') {
        return arr.sort((a, b) => {
          const na = groupedAdIdToRelatedCount[a.id] ?? 0;
          const nb = groupedAdIdToRelatedCount[b.id] ?? 0;
          if (nb !== na) return nb - na;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      if (effectiveMode === 'least_variations') {
        return arr.sort((a, b) => {
          const na = groupedAdIdToRelatedCount[a.id] ?? 0;
          const nb = groupedAdIdToRelatedCount[b.id] ?? 0;
          if (na !== nb) return na - nb;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      // newest
      return arr.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (e) {
      return groupedDedupedAds;
    }
  }, [groupedDedupedAds, groupedAdIdToRelatedCount, userSortMode]);

  // Debug: log sort mode and sample counts when relevant values change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      // small sample of counts
      const sample = Object.keys(groupedAdIdToRelatedCount)
        .slice(0, 12)
        .map((id) => ({ id, count: groupedAdIdToRelatedCount[id] }));
      // top items after sort
      const top = sortedGroupedDedupedAds
        .slice(0, 8)
        .map((a) => ({ id: a.id, variations: groupedAdIdToRelatedCount[a.id] ?? 0 }));
      // eslint-disable-next-line no-console
      console.debug(
        '[FilteredContainer] userSortMode=',
        userSortMode,
        'sampleCounts=',
        sample,
        'top=',
        top
      );
    } catch (e) {
      /* noop */
    }
  }, [userSortMode, groupedAdIdToRelatedCount, sortedGroupedDedupedAds]);

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

      {/* Результати (используем тот же ResultsGrid, чтобы поведение и группировка совпадали) */}
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
                  >
                    Select to download creo data
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        // Download only if selections exist
                        if (Object.keys(selectedIds).length > 0) {
                          downloadSelected();
                        } else {
                          try {
                            showToast({
                              message: 'Please select at least one creative to export.',
                              type: 'error',
                            });
                          } catch (e) {}
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
                        // Reset selection but keep select mode active
                        setSelectedIds({});
                        try {
                          showToast({ message: 'Selection cleared', type: 'success' });
                        } catch (e) {}
                        // visual soft fade
                        setResetFlash(true);
                        setTimeout(() => setResetFlash(false), 260);
                      }}
                      className={`px-3 py-2 text-sm rounded-md border bg-white text-slate-700 border-slate-200`}
                    >
                      Reset selection
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Ensure selection mode is on
                        const filters = currentFilters;
                        const filtersEmpty =
                          !filters ||
                          Object.values(filters).every(
                            (v) => v === '' || v === undefined || v === null
                          );

                        const targetAds = filtersEmpty ? ads : filteredAds;
                        const next: Record<string, boolean> = {};
                        for (const a of targetAds) next[String(a.id)] = true;
                        setSelectedIds(next);

                        try {
                          showToast({
                            message: `Selected ${Object.keys(next).length} creatives`,
                            type: 'success',
                          });
                        } catch (e) {}
                      }}
                      className={`px-3 py-2 text-sm rounded-md border bg-slate-50 hover:bg-slate-100 border-slate-200`}
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Exit selection mode and clear state
                        setSelectionMode(false);
                        setSelectedIds({});
                        try {
                          showToast({ message: 'Exited selection mode', type: 'success' });
                        } catch (e) {}
                      }}
                      className={`px-3 py-2 text-sm rounded-md border bg-white text-slate-700 border-slate-200`}
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
