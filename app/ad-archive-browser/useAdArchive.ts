'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import type { Ad, FilterOptions, ViewMode } from '@/lib/core/types';
import * as utils from './utils';

// --- Types ---
type AdGroupRow = {
  id: number;
  business_id: string | null;
  vector_group: number | null;
  rep_ad_archive_id: string; // The specific ID of the ad to show on the card
  items: number; // The total count of variations
  created_at?: string;
};

export type UseAdArchiveReturn = ReturnType<typeof useAdArchive>;

/**
 * UTILITY: Fetch all rows from Supabase bypassing the 1000-row limit.
 * This ensures we don't lose the group with 600 ads or any other data.
 */
async function fetchAllWithPagination<T>(
  queryFn: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  batchSize: number = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  let to = batchSize - 1;
  let fetchMore = true;

  while (fetchMore) {
    const { data, error } = await queryFn(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allData = [...allData, ...data];

      // If we got less than the batch size, we've reached the end
      if (data.length < batchSize) {
        fetchMore = false;
      } else {
        from += batchSize;
        to += batchSize;
      }
    } else {
      fetchMore = false;
    }
  }

  return allData;
}

// --- Fetcher Functions ---

// 1. Fetch ALL groups for the business
const fetchAdGroups = async (businessId: string | null | undefined) => {
  if (!businessId) return [];

  console.log(`[Fetcher] Loading groups for business: ${businessId}`);

  const query = supabase.from('ads_groups_test').select('*').eq('business_id', businessId);

  // FIX: Using "async" here ensures we return a native Promise, satisfying TypeScript
  return await fetchAllWithPagination<AdGroupRow>(async (from, to) => {
    return await query.range(from, to);
  });
};

// 2. Fetch ALL ads that belong to these groups
const fetchAdsByVectorGroups = async (
  vectorGroups: number[],
  businessId: string | null | undefined
) => {
  if (!vectorGroups.length) return [];

  console.log(`[Fetcher] Loading ads for ${vectorGroups.length} vector groups...`);

  // We chunk the vector_group IDs to avoid URL length limits in the request
  const chunkSize = 50;
  const chunks: number[][] = [];
  for (let i = 0; i < vectorGroups.length; i += chunkSize) {
    chunks.push(vectorGroups.slice(i, i + chunkSize));
  }

  const allAdPromises = chunks.map(async (chunk) => {
    try {
      let query = supabase
        .from('ads')
        .select(
          'ad_archive_id, vector_group, title, display_format, storage_path, video_storage_path, created_at, business_id'
        )
        .in('vector_group', chunk);

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      // FIX: Using "async" here ensures we return a native Promise
      return await fetchAllWithPagination<Ad>(async (from, to) => {
        return await query.range(from, to);
      });
    } catch (err) {
      console.error('Error fetching ads chunk:', err);
      return []; // Return empty array on error for this chunk
    }
  });

  const adArrays = await Promise.all(allAdPromises);
  const allAds = adArrays.flat();

  console.log(`[Fetcher] Total ads loaded: ${allAds.length}`);
  return allAds;
};

export function useAdArchive(
  initialAds: Ad[],
  initialFilters?: FilterOptions,
  initialTotalAds?: number,
  businessId?: string | null
) {
  // --- UI State ---
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState<number>(
    initialFilters?.page ? parseInt(initialFilters.page as string, 10) || 1 : 1
  );
  const itemsPerPage = initialFilters?.pageSize ?? 24;

  // Filters
  const [productFilter, setProductFilter] = useState<string>(initialFilters?.search ?? '');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    initialFilters?.businessId ?? businessId ?? null
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(initialFilters?.tags ?? []);
  const [selectedCreativeType, setSelectedCreativeType] = useState<'all' | 'video' | 'image'>(
    'all'
  );

  // Sorting & Misc
  const [userSortMode, setUserSortMode] = useState<
    'auto' | 'most_variations' | 'least_variations' | 'newest'
  >('auto');
  const [lastFilterChange, setLastFilterChange] = useState<number>(0);

  // Processing / Modal State
  const [showAINewsModal, setShowAINewsModal] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingDone, setProcessingDone] = useState(false);
  const [requestLogs, setRequestLogs] = useState<unknown[]>([]);

  // Refs
  const searchTimeout = useRef<number | null>(null);
  const clearDisplayTimeoutRef = useRef<number | null>(null);

  // --- TanStack Query Data Fetching ---

  // 1. Load Groups (Source of Truth for "Cards" and "Counts")
  const { data: groupsData = [], isLoading: isGroupsLoading } = useQuery({
    queryKey: ['adGroups', selectedBusinessId],
    queryFn: () => fetchAdGroups(selectedBusinessId),
    enabled: !!selectedBusinessId,
    staleTime: 1000 * 60 * 10, // Cache for 10 mins
    refetchOnWindowFocus: false,
  });

  // Extract unique vector groups to fetch the actual ad data
  const vectorGroupIds = useMemo(() => {
    // Safety check: ensure we only pass valid numbers
    return Array.from(
      new Set(groupsData.map((g) => g.vector_group).filter((vg): vg is number => vg != null))
    );
  }, [groupsData]);

  // 2. Load Ads (Source of Truth for "Images" and "Titles")
  const {
    data: adsData = [],
    isLoading: isAdsLoading,
    isFetching: isAdsFetching,
  } = useQuery({
    queryKey: ['adsFromGroups', selectedBusinessId, vectorGroupIds.length],
    queryFn: () => fetchAdsByVectorGroups(vectorGroupIds, selectedBusinessId),
    enabled: vectorGroupIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Determine which raw data source to use (Server Initial or Client Fetched)
  const rawAds = useMemo(() => {
    if (selectedBusinessId && adsData.length > 0) {
      return adsData;
    }
    return initialAds;
  }, [adsData, initialAds, selectedBusinessId]);

  // --- Optimized Data Processing (The "Brain") ---

  const { adIdToRelatedCount, adIdToGroupMap, representativeAds } = useMemo(() => {
    // 1. Performance: Create Maps for O(1) lookups.

    // Map: vector_group -> Array of Ads
    const adsByVectorGroup = new Map<number, Ad[]>();
    // Map: ad_archive_id -> Ad Object
    const adsById = new Map<string, Ad>();

    rawAds.forEach((ad) => {
      adsById.set(String(ad.ad_archive_id), ad);

      const vg = ad.vector_group;
      if (vg !== undefined && vg !== null) {
        if (!adsByVectorGroup.has(vg)) {
          adsByVectorGroup.set(vg, []);
        }
        adsByVectorGroup.get(vg)!.push(ad);
      }
    });

    const relatedCount: Record<string, number> = {};
    const groupMap: Record<string, Ad[]> = {};
    const representatives: Ad[] = [];

    // 2. Logic: Iterate Groups to build the UI
    if (groupsData.length > 0 && selectedBusinessId) {
      groupsData.forEach((group) => {
        const repId = String(group.rep_ad_archive_id);
        const repAd = adsById.get(repId);

        // If the representative ad exists in our loaded data
        if (repAd) {
          // A. Filter: Creative Type
          if (selectedCreativeType !== 'all') {
            const isVideo = repAd.display_format === 'VIDEO';
            if (selectedCreativeType === 'video' && !isVideo) return;
            if (selectedCreativeType === 'image' && isVideo) return;
          }

          // B. Filter: Search Text
          if (productFilter) {
            const searchLower = productFilter.toLowerCase();
            if (!repAd.title?.toLowerCase().includes(searchLower)) return;
          }

          // C. Success - Add to list
          representatives.push(repAd);

          // D. Set Count directly from `ads_groups_test` (User Requirement)
          relatedCount[repId] = group.items;

          // E. Set Variations from `ads` table (User Requirement)
          // Get all ads with same vector_group, exclude the representative itself
          if (group.vector_group !== null) {
            const allGroupAds = adsByVectorGroup.get(group.vector_group) || [];
            const similarAds = allGroupAds.filter((ad) => String(ad.ad_archive_id) !== repId);
            groupMap[repId] = similarAds;
          } else {
            groupMap[repId] = [];
          }
        }
      });
    } else {
      // Fallback: No groups loaded (or Global Search mode), just show flat list
      rawAds.forEach((ad) => {
        // Apply simple filters for fallback mode
        if (selectedCreativeType === 'video' && ad.display_format !== 'VIDEO') return;
        if (selectedCreativeType === 'image' && ad.display_format === 'VIDEO') return;
        if (productFilter && !ad.title?.toLowerCase().includes(productFilter.toLowerCase())) return;

        representatives.push(ad);
        relatedCount[String(ad.ad_archive_id)] = 0;
        groupMap[String(ad.ad_archive_id)] = [];
      });
    }

    return {
      adIdToRelatedCount: relatedCount,
      adIdToGroupMap: groupMap,
      representativeAds: representatives,
    };
  }, [groupsData, rawAds, selectedBusinessId, selectedCreativeType, productFilter]);

  // --- Sorting ---
  const sortedAds = useMemo(() => {
    const arr = [...representativeAds];
    const mode = userSortMode === 'auto' ? 'most_variations' : userSortMode;

    return arr.sort((a, b) => {
      const idA = String(a.ad_archive_id);
      const idB = String(b.ad_archive_id);

      if (mode === 'most_variations' || mode === 'least_variations') {
        const countA = adIdToRelatedCount[idA] || 0;
        const countB = adIdToRelatedCount[idB] || 0;
        if (countA !== countB)
          return mode === 'most_variations' ? countB - countA : countA - countB;
      }
      // Newest fallback
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [representativeAds, userSortMode, lastFilterChange, adIdToRelatedCount]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(sortedAds.length / itemsPerPage));

  const currentPageAds = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAds.slice(start, start + itemsPerPage);
  }, [sortedAds, currentPage, itemsPerPage]);

  const visibleAdsCount = Math.min(sortedAds.length, currentPage * itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [userSortMode, productFilter, selectedTags, selectedCreativeType, selectedBusinessId]);

  // --- Action Handlers ---

  const handleProductFilterChange = useCallback((value: string) => {
    setProductFilter(value);
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    searchTimeout.current = window.setTimeout(() => {
      setLastFilterChange(Date.now());
    }, 400) as unknown as number;
  }, []);

  const handleSearch = useCallback(async () => {
    if (productFilter.includes('facebook.com/ads/library')) {
      setProcessingMessage('Analyzing Meta link...');
      setShowAINewsModal(true);
    }
  }, [productFilter]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) setCurrentPage(page);
    },
    [totalPages]
  );

  const clearRequestLogs = useCallback(() => setRequestLogs([]), []);

  const clearProcessingDisplay = useCallback(() => {
    if (clearDisplayTimeoutRef.current) window.clearTimeout(clearDisplayTimeoutRef.current);
    setProcessingMessage('');
    setProcessingDone(false);
  }, []);

  // --- Realtime Subscriptions ---
  useEffect(() => {
    let userChannel: ReturnType<(typeof supabase)['channel']> | null = null;
    (async () => {
      const userRes = await supabase.auth.getUser();
      const uid = userRes?.data?.user?.id;
      if (!uid) return;

      userChannel = supabase
        .channel(`import-status-user-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'import_status', filter: `user_id=eq.${uid}` },
          (payload: unknown) => {
            const row = utils.getRowFromPayload(payload);
            if (row?.message) setProcessingMessage(String(row.message));
            if (row?.status === 'done' || row?.status === 'error') {
              setProcessingDone(true);
              // Auto-clear logic
              if (clearDisplayTimeoutRef.current)
                window.clearTimeout(clearDisplayTimeoutRef.current);
              clearDisplayTimeoutRef.current = window.setTimeout(() => {
                setProcessingMessage('');
                setProcessingDone(false);
              }, 6000) as unknown as number;
            }
          }
        )
        .subscribe();
    })();
    return () => {
      userChannel?.unsubscribe();
    };
  }, []);

  return {
    ads: rawAds,
    setAds: () => {},
    viewMode,
    setViewMode,
    isLoading: isGroupsLoading || isAdsLoading || isAdsFetching,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    productFilter,
    setProductFilter,
    selectedTags,
    setSelectedTags,
    showAINewsModal,
    setShowAINewsModal,
    processingMessage,
    setProcessingMessage,
    selectedCreativeType,
    setSelectedCreativeType,
    availableTags: useMemo(() => utils.uniqueTags(rawAds), [rawAds]),
    filteredAdsByType: rawAds, // Exposed if needed raw

    // Core Maps for UI
    adIdToGroupMap,
    adIdToRelatedCount,

    // Sorting & Data
    userSortMode,
    setUserSortMode,
    sortedAds,
    totalPages,
    currentPageAds,
    currentPageAdsCount: currentPageAds.length,
    visibleAdsCount,
    totalAds: sortedAds.length,

    // Actions
    handlePageChange,
    handleSearch,
    handleProductFilterChange,
    handleFilterChange: async () => {},
    clearProductFilter: useCallback(() => setProductFilter(''), []),
    videoAds: useMemo(() => rawAds.filter((a) => a.display_format === 'VIDEO').length, [rawAds]),

    // Import/Scraping State
    processingDone,
    setProcessingDone,
    // Add these state setters if they aren't used in this file but needed by return type
    numberToScrape: 10,
    setNumberToScrape: () => {},
    importJobId: null,
    importStatus: null,
    importSavedCreatives: null,
    importTotalCreatives: null,
    requestLogs,
    clearRequestLogs,
    clearProcessingDisplay,
    selectedBusinessId,
    setSelectedBusinessId,
  };
}

export default useAdArchive;
