'use client';

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import FilterPanel from '@/app/filter-bar/components/FilterPanel';
import ResultsGrid from '@/app/ad-archive-browser/components/ResultsGrid';
import { fetchAds, fetchFacets, Facets, FetchAdsParams } from '@/lib/api/ads';
import type { Ad } from '@/lib/core/types';

// Page response type for ads infinite query
type AdsPage = {
  data: Ad[];
  hasMore: boolean;
  limit: number;
  offset: number;
  groupSizes?: Record<string, number>;
  groupAdsMap?: Record<string, string[]>;
  groupAdsDetailsMap?: Record<string, Ad[]>;
};

// Helper to safely parse lists from URL (supports repeated params and legacy CSV)
const parseList = (params: URLSearchParams, key: string): string[] => {
  const all = params
    .getAll(key)
    .map((s) => s.trim())
    .filter(Boolean);
  if (all.length) return all;
  const val = params.get(key);
  return val
    ? val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
};

export default function FilteredContainer({
  showRepresentativesOnly = true,
}: {
  showRepresentativesOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restorationAttempted = useRef(false);
  const [restorationComplete, setRestorationComplete] = React.useState(false);

  // --- 0. Restore filters from sessionStorage when URL is empty ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentUrl = searchParams.toString();
    console.log('[FilteredContainer] 🔄 Mount/Update - Current URL:', currentUrl);
    console.log('[FilteredContainer] 🔄 Pathname:', pathname);
    console.log('[FilteredContainer] 🔄 Restoration attempted flag:', restorationAttempted.current);

    // Check if URL has any filter params
    const hasUrlFilters = Array.from(searchParams.entries()).some(([key]) =>
      [
        'businessId',
        'pageNames',
        'displayFormats',
        'ctaTypes',
        'concepts',
        'realizations',
        'topics',
        'hooks',
        'characters',
        'platforms',
        'search',
        'funnels',
        'variationCounts',
        'dateRanges',
      ].includes(key)
    );

    if (hasUrlFilters) {
      console.log(
        '[FilteredContainer] URL already has filters:',
        Array.from(searchParams.entries())
      );
      restorationAttempted.current = false; // Reset for next time
      setRestorationComplete(true); // Mark as complete so auto-select can proceed
      return;
    }

    // If URL is empty and we haven't tried restoration yet
    if (!currentUrl && !restorationAttempted.current) {
      console.log('[FilteredContainer] Empty URL detected, attempting restoration...');
      restorationAttempted.current = true;

      try {
        const saved = sessionStorage.getItem('advanceFilterState');

        if (saved) {
          const savedFilters = JSON.parse(saved);
          console.log('[FilteredContainer] Found saved filters in sessionStorage:', savedFilters);

          // Check if saved filters have any actual content
          const hasContent =
            savedFilters.businessId ||
            savedFilters.pageNames?.length > 0 ||
            savedFilters.displayFormats?.length > 0 ||
            savedFilters.ctaTypes?.length > 0 ||
            savedFilters.concepts?.length > 0 ||
            savedFilters.topics?.length > 0 ||
            savedFilters.hooks?.length > 0 ||
            savedFilters.searchQuery;

          if (hasContent) {
            const params = new URLSearchParams();

            // Reconstruct URL from saved filters
            if (savedFilters.businessId) params.set('businessId', savedFilters.businessId);
            if (savedFilters.pageNames?.length)
              savedFilters.pageNames.forEach((v: string) => params.append('pageNames', v));
            if (savedFilters.displayFormats?.length)
              savedFilters.displayFormats.forEach((v: string) =>
                params.append('displayFormats', v)
              );
            if (savedFilters.ctaTypes?.length)
              savedFilters.ctaTypes.forEach((v: string) => params.append('ctaTypes', v));
            if (savedFilters.concepts?.length)
              savedFilters.concepts.forEach((v: string) => params.append('concepts', v));
            if (savedFilters.realizations?.length)
              savedFilters.realizations.forEach((v: string) => params.append('realizations', v));
            if (savedFilters.topics?.length)
              savedFilters.topics.forEach((v: string) => params.append('topics', v));
            if (savedFilters.hooks?.length)
              savedFilters.hooks.forEach((v: string) => params.append('hooks', v));
            if (savedFilters.characters?.length)
              savedFilters.characters.forEach((v: string) => params.append('characters', v));
            if (savedFilters.platforms?.length)
              savedFilters.platforms.forEach((v: string) => params.append('platforms', v));
            if (savedFilters.searchQuery) params.set('search', savedFilters.searchQuery);
            if (savedFilters.funnels?.length)
              savedFilters.funnels.forEach((v: string) => params.append('funnels', v));
            if (savedFilters.variationCounts?.length)
              savedFilters.variationCounts.forEach((v: string) =>
                params.append('variationCounts', v)
              );
            if (savedFilters.dateRanges?.length)
              savedFilters.dateRanges.forEach((v: string) => params.append('dateRanges', v));

            const queryString = params.toString();
            const newUrl = `${pathname}?${queryString}`;
            console.log('[FilteredContainer] ✅ RESTORING filters to URL:', newUrl);

            // Use push instead of replace to ensure navigation happens
            router.push(newUrl);
            // Mark restoration complete after navigation
            setTimeout(() => setRestorationComplete(true), 100);
          } else {
            console.log('[FilteredContainer] Saved filters are empty, skipping restoration');
            setRestorationComplete(true);
          }
        } else {
          console.log('[FilteredContainer] No saved filters found in sessionStorage');
          setRestorationComplete(true);
        }
      } catch (e) {
        console.error('[FilteredContainer] ❌ Failed to restore filters:', e);
        setRestorationComplete(true);
      }
    } else {
      // URL not empty but also not triggering restoration - mark complete
      if (!restorationAttempted.current) {
        setRestorationComplete(true);
      }
    }
  }, [pathname, router, searchParams]);

  // --- 1. Source of Truth: URL Search Params ---
  // We derive the entire state from the URL. This ensures persistence on reload.
  const filters = useMemo(() => {
    const p = searchParams;
    return {
      businessId: p.get('businessId') || '',
      pageNames: parseList(p, 'pageNames'),
      displayFormats: parseList(p, 'displayFormats'),
      ctaTypes: parseList(p, 'ctaTypes'),
      concepts: parseList(p, 'concepts'),
      realizations: parseList(p, 'realizations'),
      topics: parseList(p, 'topics'),
      hooks: parseList(p, 'hooks'),
      characters: parseList(p, 'characters'),
      platforms: parseList(p, 'platforms'),
      searchQuery: p.get('search') || '',
      funnels: parseList(p, 'funnels'),
      variationCounts: parseList(p, 'variationCounts'),
      dateRanges: parseList(p, 'dateRanges'),
    };
  }, [searchParams]);

  // --- 1.5. Save filters to sessionStorage whenever they change ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Always save if businessId exists (even if other filters are empty)
        if (filters.businessId) {
          console.log('[FilteredContainer] 💾 Saving filters to sessionStorage:', filters);
          sessionStorage.setItem('advanceFilterState', JSON.stringify(filters));
        } else {
          console.log('[FilteredContainer] No businessId, not saving');
        }
      } catch (e) {
        console.error('Failed to save filters to sessionStorage:', e);
      }
    }
  }, [filters]);

  // --- 2. Prepare API Params ---
  const apiParams: Omit<FetchAdsParams, 'limit' | 'offset'> = useMemo(
    () => ({
      businessId: filters.businessId,
      pageNames: filters.pageNames,
      displayFormats: filters.displayFormats,
      ctaTypes: filters.ctaTypes,
      concepts: filters.concepts,
      realizations: filters.realizations,
      topics: filters.topics,
      hooks: filters.hooks,
      characters: filters.characters,
      platforms: filters.platforms,
      search: filters.searchQuery,
      funnels: filters.funnels,
      variationCounts: filters.variationCounts,
      dateRanges: filters.dateRanges,
      representativesOnly: showRepresentativesOnly,
    }),
    [filters, showRepresentativesOnly]
  );

  // --- 3. Fetch Facets (Dropdown Data) ---
  const { data: facetsData } = useQuery<Facets>({
    queryKey: ['facets', apiParams],
    queryFn: () => fetchFacets(apiParams),
    staleTime: 1000 * 30, // Cache for 30s
  });

  // --- 4. Fetch Ads (Infinite List) ---
  const pageSize = 36;
  const {
    data: adsData,
    fetchNextPage,
    hasNextPage,
    isFetching: isAdsLoading,
    isLoading: isAdsInitialLoading,
  } = useInfiniteQuery<AdsPage, Error>({
    queryKey: ['ads', apiParams, showRepresentativesOnly],
    queryFn: ({ pageParam = 0 }) =>
      // Ensure fetchAds is implemented to handle the logic of finding representatives
      fetchAds({ ...apiParams, limit: pageSize, offset: pageParam as number }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.offset + pageSize : undefined),
    initialPageParam: 0,
    refetchOnWindowFocus: false,
  });

  const ads = useMemo(() => adsData?.pages.flatMap((p) => p.data) || [], [adsData]);

  // Build adIdToRelatedCount from groupSizes (items count) returned by API
  const adIdToRelatedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!adsData?.pages) return counts;

    adsData.pages.forEach((page) => {
      if (page.groupSizes) {
        Object.entries(page.groupSizes).forEach(([repId, variationsCount]) => {
          // variationsCount is the length of items array from ads_groups_test
          counts[repId] = variationsCount;
        });
      }
    });

    return counts;
  }, [adsData]);

  // Build adIdToGroupMap - map each rep to all ads in its group (for cards)
  const adIdToGroupMap = useMemo(() => {
    const groupMap: Record<string, Ad[]> = {};
    if (!adsData?.pages) return groupMap;

    // Prefer full group ads from API when available
    let hasDetails = false;
    adsData.pages.forEach((page) => {
      if (page.groupAdsDetailsMap) {
        hasDetails = true;
        Object.entries(page.groupAdsDetailsMap).forEach(([repId, groupAds]) => {
          groupMap[repId] = (groupAds || []).filter(
            (ad) => ad && String(ad.ad_archive_id) !== repId
          ) as Ad[];
        });
      }
    });

    if (hasDetails) return groupMap;

    // Fallback: map IDs to ads in current page only
    const adsById: Record<string, Ad> = {};
    ads.forEach((ad) => {
      adsById[String(ad.ad_archive_id)] = ad;
    });

    adsData.pages.forEach((page) => {
      if (page.groupAdsMap) {
        Object.entries(page.groupAdsMap).forEach(([repId, adIds]) => {
          const groupAds = adIds
            .filter((id) => id !== repId)
            .map((id) => adsById[id])
            .filter((ad) => ad != null);
          groupMap[repId] = groupAds;
        });
      }
    });

    return groupMap;
  }, [adsData, ads]);

  // --- 5. Filter Update Handler ---
  // Updates the URL, triggering a re-render of the component and re-fetch of queries
  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      console.log('[FilteredContainer] handleFiltersChange called with:', newFilters);
      console.log('[FilteredContainer] Current filters:', filters);

      // Start with current URL params to preserve existing filters
      const params = new URLSearchParams(searchParams.toString());

      const update = (key: string, val: string | string[] | undefined) => {
        if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
          params.delete(key);
          return;
        }
        params.delete(key);
        if (Array.isArray(val)) {
          val.forEach((item) => {
            if (item) params.append(key, item);
          });
        } else {
          params.set(key, val);
        }
      };

      // Update all filters normally (only if they're provided in newFilters)
      if ('businessId' in newFilters) update('businessId', newFilters.businessId);
      if ('pageNames' in newFilters) update('pageNames', newFilters.pageNames);
      if ('displayFormats' in newFilters) update('displayFormats', newFilters.displayFormats);
      if ('ctaTypes' in newFilters) update('ctaTypes', newFilters.ctaTypes);
      if ('conceptFormats' in newFilters)
        update(
          'concepts',
          (newFilters as Record<string, string | string[] | undefined>).conceptFormats
        );
      if ('realizationFormats' in newFilters)
        update(
          'realizations',
          (newFilters as Record<string, string | string[] | undefined>).realizationFormats
        );
      if ('topicFormats' in newFilters)
        update(
          'topics',
          (newFilters as Record<string, string | string[] | undefined>).topicFormats
        );
      if ('hookFormats' in newFilters)
        update('hooks', (newFilters as Record<string, string | string[] | undefined>).hookFormats);
      if ('characterFormats' in newFilters)
        update(
          'characters',
          (newFilters as Record<string, string | string[] | undefined>).characterFormats
        );
      if ('publisherPlatforms' in newFilters)
        update(
          'platforms',
          (newFilters as Record<string, string | string[] | undefined>).publisherPlatforms
        );
      if ('searchQuery' in newFilters) update('search', newFilters.searchQuery);
      if ('funnels' in newFilters) update('funnels', newFilters.funnels);
      if ('variationCounts' in newFilters) update('variationCounts', newFilters.variationCounts);
      if ('dateRanges' in newFilters) update('dateRanges', newFilters.dateRanges);

      const newUrl = `${pathname}?${params.toString()}`;
      console.log('[FilteredContainer] Updating URL to:', newUrl);

      // Using replace so we don't clutter browser history with every checkbox click
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, router, pathname, filters]
  );

  // --- 6. Defaults & Auto-selection ---
  const panelOptions: Facets = facetsData || {
    pageNames: [],
    publisherPlatforms: [],
    ctaTypes: [],
    displayFormats: [],
    conceptFormats: [],
    realizationFormats: [],
    topicFormats: [],
    hookFormats: [],
    characterFormats: [],
    variationBuckets: [],
    dateRangeOptions: [],
    funnels: [],
    businesses: [],
    counts: {},
  };

  const normalizedCounts = {
    pageNames: panelOptions.counts?.pageNames ?? {},
    publisherPlatforms: panelOptions.counts?.publisherPlatforms ?? {},
    ctaTypes: panelOptions.counts?.ctaTypes ?? {},
    displayFormats: panelOptions.counts?.displayFormats ?? {},
    conceptFormats: panelOptions.counts?.conceptFormats ?? {},
    realizationFormats: panelOptions.counts?.realizationFormats ?? {},
    topicFormats: panelOptions.counts?.topicFormats ?? {},
    hookFormats: panelOptions.counts?.hookFormats ?? {},
    characterFormats: panelOptions.counts?.characterFormats ?? {},
    variationCounts: panelOptions.counts?.variationCounts ?? {},
    dateRanges: panelOptions.counts?.dateRanges ?? {},
    funnels: panelOptions.counts?.funnels ?? {},
  };

  // Auto-select first business if none selected and no saved filters exist
  useEffect(() => {
    // CRITICAL: Wait for restoration to complete before auto-selecting
    if (!restorationComplete) {
      console.log(
        '[FilteredContainer] ⏸️ Auto-select blocked - waiting for restoration to complete'
      );
      return;
    }

    // Don't auto-select if URL already has filters
    const hasExistingFilters = Array.from(searchParams.entries()).length > 0;

    if (!filters.businessId && panelOptions.businesses.length > 0 && !hasExistingFilters) {
      // Check if there are saved filters in sessionStorage first
      try {
        const saved = sessionStorage.getItem('advanceFilterState');
        if (saved) {
          const savedFilters = JSON.parse(saved);
          if (savedFilters.businessId) {
            console.log(
              '[FilteredContainer] ⏭️ Skipping auto-select, sessionStorage has saved businessId'
            );
            return; // Don't auto-select, let restoration handle it
          }
        }
      } catch (e) {
        console.error('Failed to check sessionStorage:', e);
      }

      console.log('[FilteredContainer] 🎯 Auto-selecting first business');
      const firstBizId = String(panelOptions.businesses[0].id);
      const params = new URLSearchParams(searchParams.toString());
      params.set('businessId', firstBizId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [
    filters.businessId,
    panelOptions.businesses,
    pathname,
    router,
    searchParams,
    restorationComplete,
  ]);

  return (
    <div className="space-y-6">
      <FilterPanel
        onFiltersChange={handleFiltersChange}
        availableOptions={panelOptions}
        counts={normalizedCounts}
        // Pass current state to panel so checkboxes are checked
        initialBusinessId={filters.businessId}
        initialPageNames={filters.pageNames}
        initialDisplayFormats={filters.displayFormats}
        initialCtaTypes={filters.ctaTypes}
        initialConcepts={filters.concepts}
        initialRealizations={filters.realizations}
        initialTopics={filters.topics}
        initialTopic={filters.topics[0]}
        initialHooks={filters.hooks}
        initialHook={filters.hooks[0]}
        initialCharacters={filters.characters}
        initialPlatforms={filters.platforms}
        initialSearchQuery={filters.searchQuery}
        initialFunnels={filters.funnels}
        initialVariationCounts={filters.variationCounts}
        initialDateRanges={filters.dateRanges}
      />

      <div className="min-h-[400px]">
        {/* Loading State */}
        {isAdsInitialLoading || (isAdsLoading && ads.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p>Loading representatives...</p>
          </div>
        ) : ads.length === 0 ? (
          /* Empty State */
          <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <h3 className="text-lg font-medium text-slate-900">No ads found</h3>
            <p className="text-slate-500 mt-1">
              Try adjusting your filters. We are showing representatives for business ID:{' '}
              {filters.businessId}
            </p>
            <button
              onClick={() => {
                // Clear sessionStorage when clearing all filters
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('advanceFilterState');
                  console.log('[FilteredContainer] Cleared sessionStorage filters');
                }
                router.push(pathname);
              }}
              className="mt-4 text-blue-600 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          /* Results */
          <>
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="text-sm font-medium text-slate-500">
                Found {ads.length} representatives
              </span>
              {isAdsLoading && (
                <span className="text-xs text-blue-600 animate-pulse">Updating...</span>
              )}
            </div>

            <ResultsGrid
              isLoading={isAdsLoading && ads.length > 0}
              currentPageAds={ads}
              adIdToGroupMap={adIdToGroupMap}
              adIdToRelatedCount={adIdToRelatedCount}
              filteredAdsByType={ads}
              selectionMode={false}
              selectedIds={{}}
              onToggleSelect={() => {}}
              showAINewsModal={false}
              processingMessage=""
              selectedCreativeType="all"
              viewMode="grid"
            />

            {hasNextPage && (
              <div className="mt-8 flex justify-center pb-8">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isAdsLoading}
                  className="bg-white border border-slate-300 text-slate-700 font-medium px-6 py-2 rounded-full hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isAdsLoading ? 'Loading...' : 'Load More Groups'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
