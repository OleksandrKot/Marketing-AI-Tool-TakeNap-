'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/core/supabase';
import type { Ad, FilterOptions, ViewMode } from '@/lib/core/types';
import { getAds } from '../actions';
import * as utils from './utils';

declare global {
  interface Window {
    __lastPhashCheck?: number;
  }
}

export type UseAdArchiveReturn = ReturnType<typeof useAdArchive>;

export function useAdArchive(
  initialAds: Ad[],
  initialFilters?: FilterOptions,
  initialTotalAds?: number,
  pollIntervalMs: number = 60 * 1000,
  businessId?: string | null
) {
  // --- State Management ---
  const [ads, setAds] = useState<Ad[]>(initialAds);
  const [adGroups, setAdGroups] = useState<
    Array<{ id: string; representative_ad_id: string; ad_ids: string[] }>
  >([]);
  const [groupAdsMap, setGroupAdsMap] = useState<Record<string, Ad[]>>({}); // group ID -> all ads in group
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(
    initialFilters?.page ? parseInt(initialFilters.page as string, 10) || 1 : 1
  );
  const itemsPerPage = initialFilters?.pageSize ?? 24;

  const [productFilter, setProductFilter] = useState<string>(initialFilters?.search ?? '');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    initialFilters?.businessId ?? businessId ?? null
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(initialFilters?.tags ?? []);
  const [selectedCreativeType, setSelectedCreativeType] = useState<'all' | 'video' | 'image'>(
    'all'
  );

  const [showAINewsModal, setShowAINewsModal] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingDone, setProcessingDone] = useState(false);
  const [numberToScrape, setNumberToScrape] = useState<number>(10);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importSavedCreatives, setImportSavedCreatives] = useState<number | null>(null);
  const [importTotalCreatives, setImportTotalCreatives] = useState<number | null>(null);
  const [autoClearProcessing] = useState<boolean>(true);
  const [userSortMode, setUserSortMode] = useState<
    'auto' | 'most_variations' | 'least_variations' | 'newest'
  >('auto');
  const [lastFilterChange, setLastFilterChange] = useState<number>(0);
  const [requestLogs, setRequestLogs] = useState<
    Array<{
      id: string;
      time: string;
      type?: string;
      text?: string;
      meta?: Record<string, unknown>;
    }>
  >([]);

  // --- Refs ---
  const jobChannelRef = useRef<ReturnType<(typeof supabase)['channel']> | null>(null);
  const clearDisplayTimeoutRef = useRef<number | null>(null);
  const searchTimeout = useRef<number | null>(null);
  const isLoadingRef = useRef<boolean>(false);

  // Sync ads and business selection when props change
  useEffect(() => {
    setAds(initialAds);
    setSelectedBusinessId(initialFilters?.businessId ?? businessId ?? null);
  }, [initialAds, initialFilters?.businessId, businessId]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // --- Fetch ad groups from ads_groups_test table ---
  const fetchAdGroups = useCallback(async () => {
    const bizKey = selectedBusinessId || null;
    let cancelled = false;
    try {
      // Load groups with their representatives
      let groupQuery = supabase.from('ads_groups_test').select('*');
      if (bizKey) groupQuery = groupQuery.eq('business_id', bizKey);
      const { data, error } = await groupQuery;
      if (cancelled || bizKey !== (selectedBusinessId || null)) return;

      if (error) {
        console.error('Error fetching ad groups:', error);
        return;
      }

      if (!data || data.length === 0) {
        setAdGroups([]);
        setGroupAdsMap({});
        return;
      }

      // Transform structure for compatibility
      const groups = data.map((g: Record<string, unknown>) => ({
        id: String(g.vector_group),
        representative_ad_id: String(g.rep_ad_archive_id),
        ad_ids: [], // will be filled when loading ads
      }));

      setAdGroups((prev) => {
        if (cancelled || bizKey !== (selectedBusinessId || null)) return prev;
        return groups;
      });

      // Load all ads for each group by vector_group
      const vectorGroups = Array.from(
        new Set<number>(
          data.map((g) => g.vector_group).filter((vg) => vg !== null && vg !== undefined)
        )
      );

      if (vectorGroups.length === 0) {
        setGroupAdsMap({});
        return;
      }

      console.log(`Loading ads for ${vectorGroups.length} vector groups`);

      // Split into chunks of 100 vector_groups (to avoid overloading request)
      const chunkSize = 100;
      const map: Record<string, Ad[]> = {};

      for (let i = 0; i < vectorGroups.length; i += chunkSize) {
        const chunk = vectorGroups.slice(i, i + chunkSize);

        let adsQuery = supabase
          .from('ads')
          .select(
            'ad_archive_id, vector_group, title, display_format, storage_path, video_storage_path, created_at'
          )
          .in('vector_group', chunk);
        if (selectedBusinessId) adsQuery = adsQuery.eq('business_id', selectedBusinessId);
        const { data: fetchedGroupAds, error: adsError } = await adsQuery;
        if (cancelled || bizKey !== (selectedBusinessId || null)) return;

        if (adsError) {
          console.error(`Error fetching group ads chunk ${i / chunkSize}:`, adsError);
          continue;
        }

        if (fetchedGroupAds) {
          fetchedGroupAds.forEach((ad) => {
            const vg = ad.vector_group;
            if (!map[vg]) map[vg] = [];
            map[vg].push(ad as Ad);
          });
        }
      }

      setGroupAdsMap((prev) => {
        if (cancelled || bizKey !== (selectedBusinessId || null)) return prev;
        return map;
      });
    } catch (error) {
      console.error('Error fetching ad groups:', error);
    }
    return () => {
      cancelled = true;
    };
  }, [selectedBusinessId]);

  // Clear current groups immediately when business changes
  useEffect(() => {
    setAdGroups([]);
    setGroupAdsMap({});
    setAds([]);
  }, [selectedBusinessId]);

  // Fetch groups on mount and when business changes
  useEffect(() => {
    fetchAdGroups();
  }, [fetchAdGroups, selectedBusinessId]);

  // --- UI & Status Helpers ---
  const clearRequestLogs = useCallback(() => setRequestLogs([]), []);

  const scheduleClearDisplay = useCallback(
    (delay = 6000) => {
      if (!autoClearProcessing) return;
      if (clearDisplayTimeoutRef.current) window.clearTimeout(clearDisplayTimeoutRef.current);

      clearDisplayTimeoutRef.current = window.setTimeout(() => {
        setProcessingMessage('');
        setImportStatus(null);
        setImportSavedCreatives(null);
        setImportTotalCreatives(null);
        setProcessingDone(false);
        setImportJobId(null);
        clearDisplayTimeoutRef.current = null;
      }, delay) as unknown as number;
    },
    [autoClearProcessing]
  );

  const clearProcessingDisplay = useCallback(() => {
    if (clearDisplayTimeoutRef.current) window.clearTimeout(clearDisplayTimeoutRef.current);
    setProcessingMessage('');
    setImportStatus(null);
    setImportSavedCreatives(null);
    setImportTotalCreatives(null);
    setProcessingDone(false);
    setImportJobId(null);
    jobChannelRef.current?.unsubscribe();
  }, []);

  // --- Get representatives and related ads ---

  // 1. Filter by creative type
  const filteredAdsByType = useMemo(() => {
    return ads.filter((ad) => {
      if (selectedCreativeType === 'all') return true;
      return selectedCreativeType === 'video'
        ? ad.display_format === 'VIDEO'
        : ad.display_format === 'IMAGE';
    });
  }, [ads, selectedCreativeType]);

  // 2. Build lookup maps from ad groups
  const { adIdToRelatedCount, adIdToGroupMap, representativeAds } = useMemo(() => {
    const relatedCount: Record<string, number> = {};
    const groupMap: Record<string, Ad[]> = {};
    const representatives: Ad[] = [];
    const repIdSet = new Set<string>();

    // Iterate over groups from ads_groups_test
    adGroups.forEach((group) => {
      const repAdId = String(group.representative_ad_id);

      // Get all ads for group from groupAdsMap by group.id (vector_group)
      const groupAds = groupAdsMap[group.id] || [];

      if (groupAds.length === 0) return;

      // Find representative in group by ad_archive_id
      const representative = groupAds.find((ad) => String(ad.ad_archive_id) === repAdId);
      if (!representative) {
        // If not found by ad_archive_id, use first one
        const rep = groupAds[0];
        if (!repIdSet.has(String(rep.ad_archive_id))) {
          representatives.push(rep);
          repIdSet.add(String(rep.ad_archive_id));
        }

        const relatedAds = groupAds.slice(1);
        relatedCount[String(rep.ad_archive_id)] = relatedAds.length;
        groupMap[String(rep.ad_archive_id)] = relatedAds;
        return;
      }

      const repId = String(representative.ad_archive_id);

      // Add representative only once
      if (!repIdSet.has(repId)) {
        representatives.push(representative);
        repIdSet.add(repId);
      }

      // Related Ads = all other ads in group (without representative)
      const relatedAds = groupAds.filter((ad) => String(ad.ad_archive_id) !== repId);

      // Fill maps
      relatedCount[repId] = relatedAds.length;
      groupMap[repId] = relatedAds; // Only related ads, without the representative itself

      // For all ads in group also save related ads
      groupAds.forEach((ad) => {
        const adId = String(ad.ad_archive_id);
        groupMap[adId] = relatedAds;
      });
    });

    return {
      adIdToRelatedCount: relatedCount,
      adIdToGroupMap: groupMap,
      representativeAds: representatives,
    };
  }, [adGroups, groupAdsMap]);

  // --- Sorting & Pagination ---

  const sortedAds = useMemo(() => {
    const arr = [...representativeAds];
    const mode =
      userSortMode === 'auto'
        ? lastFilterChange > 0
          ? 'most_variations'
          : 'most_variations'
        : userSortMode;

    return arr.sort((a, b) => {
      if (mode === 'most_variations' || mode === 'least_variations') {
        const countA = adIdToRelatedCount[String(a.ad_archive_id)] || 0;
        const countB = adIdToRelatedCount[String(b.ad_archive_id)] || 0;
        if (countA !== countB)
          return mode === 'most_variations' ? countB - countA : countA - countB;
      }
      // Fallback to newest
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [representativeAds, userSortMode, lastFilterChange, adIdToRelatedCount]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedAds.length / itemsPerPage)),
    [sortedAds, itemsPerPage]
  );

  const currentPageAds = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAds.slice(start, start + itemsPerPage);
  }, [sortedAds, currentPage, itemsPerPage]);

  const visibleAdsCount = useMemo(
    () => Math.min(sortedAds.length, currentPage * itemsPerPage),
    [sortedAds, currentPage, itemsPerPage]
  );
  const totalAds = typeof initialTotalAds === 'number' ? initialTotalAds : sortedAds.length;

  // Reset page on sort or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [userSortMode, productFilter, selectedTags, selectedCreativeType]);

  // --- Handlers ---

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) setCurrentPage(page);
    },
    [totalPages]
  );

  const fetchUpdatedAds = useCallback(
    async (filters: Partial<FilterOptions>) => {
      setIsLoading(true);
      try {
        const raw = await getAds(
          filters.search ?? productFilter,
          filters.page ?? null,
          filters.date ?? null,
          filters.tags ?? selectedTags,
          filters.publisherPlatform ?? undefined,
          selectedBusinessId ?? undefined
        );
        const fetched = utils.extractDataArray(raw);
        setAds(fetched);
      } catch (error) {
        console.error('Error fetching ads:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [productFilter, selectedTags, selectedBusinessId]
  );

  const handleSearch = useCallback(async () => {
    const searchValue = productFilter.trim();
    if (searchValue.includes('facebook.com/ads/library')) {
      setProcessingMessage('Analyzing Meta link...');
      setShowAINewsModal(true);
    } else {
      await fetchUpdatedAds({ search: searchValue });
    }
  }, [productFilter, fetchUpdatedAds]);

  const handleProductFilterChange = useCallback(
    (value: string) => {
      setProductFilter(value);
      if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
      searchTimeout.current = window.setTimeout(() => {
        setLastFilterChange(Date.now());
        fetchUpdatedAds({ search: value });
      }, 400) as unknown as number;
    },
    [fetchUpdatedAds]
  );

  // Handle filter changes for date, page, tags
  const handleFilterChange = useCallback(
    async (filters: Partial<FilterOptions>) => {
      try {
        await fetchUpdatedAds(filters);
      } catch (e) {
        console.error('Error applying filters:', e);
      }
    },
    [fetchUpdatedAds]
  );

  // --- Real-time Subscriptions (Supabase) ---
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
          (payload) => {
            const row = utils.getRowFromPayload(payload);
            if (row?.message) setProcessingMessage(String(row.message));
            if (row?.status === 'done' || row?.status === 'error') {
              setProcessingDone(true);
              scheduleClearDisplay();
            }
          }
        )
        .subscribe();
    })();

    return () => {
      userChannel?.unsubscribe();
    };
  }, [scheduleClearDisplay]);

  // --- Polling Logic (DISABLED - /api/ads/head is too slow) ---
  useEffect(() => {
    // Temporarily disabled due to performance issues
    // TODO: Implement faster polling mechanism
    return;

    if (!pollIntervalMs || pollIntervalMs <= 0) return;

    const intervalId = window.setInterval(async () => {
      if (isLoadingRef.current) return;

      try {
        const res = await fetch('/api/ads/head');
        const head = await res.json();
        if (head.present !== ads.length) {
          await fetchUpdatedAds({});
          await fetchAdGroups();
        }
      } catch (e) {
        console.debug('Polling check failed', e);
      }
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [pollIntervalMs, ads.length, fetchUpdatedAds, fetchAdGroups]);

  return {
    ads,
    setAds,
    viewMode,
    setViewMode,
    isLoading,
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
    availableTags: useMemo(() => utils.uniqueTags(ads), [ads]),
    filteredAdsByType,
    adIdToGroupMap,
    adIdToRelatedCount,
    userSortMode,
    setUserSortMode,
    sortedAds,
    totalPages,
    currentPageAds,
    currentPageAdsCount: currentPageAds.length,
    visibleAdsCount,
    totalAds,
    handlePageChange,
    handleSearch,
    handleProductFilterChange,
    handleFilterChange,
    clearProductFilter: useCallback(() => {
      setProductFilter('');
      fetchUpdatedAds({ search: '' });
    }, [fetchUpdatedAds]),
    videoAds: useMemo(() => ads.filter((a) => a.display_format === 'VIDEO').length, [ads]),
    processingDone,
    setProcessingDone,
    numberToScrape,
    setNumberToScrape,
    importJobId,
    importStatus,
    importSavedCreatives,
    importTotalCreatives,
    requestLogs,
    clearRequestLogs,
    clearProcessingDisplay,
    selectedBusinessId,
    setSelectedBusinessId,
  };
}

export default useAdArchive;
