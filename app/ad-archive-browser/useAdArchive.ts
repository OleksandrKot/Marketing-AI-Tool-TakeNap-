'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { Ad, FilterOptions, ViewMode } from '@/lib/types';
import { getAds } from '../actions';
import * as utils from './utils';

export function useAdArchive(
  initialAds: Ad[],
  initialFilters?: FilterOptions,
  initialTotalAds?: number,
  pollIntervalMs: number = 5 * 60 * 1000 // default to 5 minutes
) {
  const [ads, setAds] = useState<Ad[]>(initialAds);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const initialPage = initialFilters?.page ? parseInt(initialFilters.page as string, 10) || 1 : 1;
  const initialPageSize = initialFilters?.pageSize ?? 12;
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const itemsPerPage = initialPageSize;
  const [productFilter, setProductFilter] = useState<string>(initialFilters?.search ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialFilters?.tags ?? []);
  const [showAINewsModal, setShowAINewsModal] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingDone, setProcessingDone] = useState(false);
  const [selectedCreativeType, setSelectedCreativeType] = useState<'all' | 'video' | 'image'>(
    'all'
  );

  // Compute availableTags from ads and memoize to avoid recomputation on unrelated state changes
  const availableTags: string[] = useMemo(() => {
    try {
      if (typeof utils.uniqueTags === 'function') {
        return utils.uniqueTags(ads);
      }
    } catch (e) {
      console.debug('utils.uniqueTags threw, falling back to local extraction', e);
    }

    const set = new Set<string>();
    for (const a of ads) {
      if (Array.isArray(a.tags)) for (const t of a.tags) if (t) set.add(t);
    }
    return Array.from(set).sort();
  }, [ads]);

  const filteredAdsByType = useMemo(() => {
    return ads.filter((ad) => {
      if (selectedCreativeType === 'all') return true;
      if (selectedCreativeType === 'video') return ad.display_format === 'VIDEO';
      if (selectedCreativeType === 'image') return ad.display_format === 'IMAGE';
      return true;
    });
  }, [ads, selectedCreativeType]);

  const groupedAll = useMemo(() => {
    const map = new Map<string, Ad[]>();
    for (const ad of filteredAdsByType) {
      const key = utils.getGroupingKey(ad);
      const arr = map.get(key);
      if (arr) arr.push(ad);
      else map.set(key, [ad]);
    }
    return map;
  }, [filteredAdsByType]);

  // Helper to safely extract an array from API responses which may be either
  // an array or an object containing a `data` array. Avoid using `any` — use
  // unknown and type guards instead.
  function extractDataArray(raw: unknown): Ad[] {
    if (Array.isArray(raw)) return raw as Ad[];
    if (raw && typeof raw === 'object' && raw !== null && 'data' in raw) {
      const r = raw as Record<string, unknown>;
      if (Array.isArray(r.data)) return r.data as Ad[];
    }
    return [];
  }

  const adIdToGroupMap: Record<string, Ad[]> = useMemo(() => {
    const out: Record<string, Ad[]> = {};
    groupedAll.forEach((groupAds) => {
      for (const ad of groupAds) out[ad.id] = groupAds;
    });
    return out;
  }, [groupedAll]);

  const ungroupedPages = useMemo(
    () => utils.chunk(filteredAdsByType, itemsPerPage),
    [filteredAdsByType, itemsPerPage]
  );

  const totalPages = useMemo(() => {
    if (typeof initialTotalAds === 'number' && initialTotalAds >= 0) {
      return Math.max(1, Math.ceil(initialTotalAds / itemsPerPage));
    }
    return Math.max(1, ungroupedPages.length);
  }, [initialTotalAds, ungroupedPages, itemsPerPage]);

  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const currentPageAds = useMemo(
    () => ungroupedPages[currentPage - 1] || [],
    [ungroupedPages, currentPage]
  );
  const currentPageAdsCount = currentPageAds.length;

  const visibleAdsCount = useMemo(() => {
    if (typeof initialTotalAds === 'number') {
      return Math.min(initialTotalAds, currentPage * itemsPerPage);
    }
    return ungroupedPages.slice(0, currentPage).reduce((sum, pg) => sum + pg.length, 0);
  }, [initialTotalAds, ungroupedPages, currentPage, itemsPerPage]);

  const totalAds = typeof initialTotalAds === 'number' ? initialTotalAds : filteredAdsByType.length;

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages]
  );

  const handleFilterChange = useCallback(async (filters: FilterOptions) => {
    setIsLoading(true);
    try {
      const raw = await getAds(
        filters.search,
        filters.page,
        filters.date,
        filters.tags,
        // publisherPlatform is optional on FilterOptions
        filters.publisherPlatform
      );
      const fetched: Ad[] = extractDataArray(raw);
      // apply client-side creative type filter so UI respects selectedCreativeType
      const final =
        selectedCreativeType === 'all'
          ? fetched
          : fetched.filter((ad) =>
              selectedCreativeType === 'video'
                ? ad.display_format === 'VIDEO'
                : ad.display_format === 'IMAGE'
            );
      setAds(final);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error filtering ads:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTagsChange = useCallback(
    async (tags: string[]) => {
      setSelectedTags(tags);
      setIsLoading(true);
      try {
        const raw = await getAds(productFilter || '', null, null, tags);
        const filtered: Ad[] = extractDataArray(raw);
        const final =
          selectedCreativeType === 'all'
            ? filtered
            : filtered.filter((ad) =>
                selectedCreativeType === 'video'
                  ? ad.display_format === 'VIDEO'
                  : ad.display_format === 'IMAGE'
              );
        setAds(final);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error filtering by tags:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [productFilter]
  );

  const handleSearch = useCallback(async () => {
    const searchValue = productFilter.trim();

    if (!searchValue && selectedTags.length === 0) {
      try {
        const raw = await getAds(undefined, null, null, undefined);
        const allAds: Ad[] = extractDataArray(raw);
        setAds(allAds);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error resetting ads:', error);
      }
      return;
    }

    const isMetaLink = searchValue.includes('facebook.com/ads/library');

    if (isMetaLink) {
      const typeMessages = {
        all: `Analyzing link and extracting all creatives (video & static)...`,
        video: `Analyzing link and extracting VIDEO creatives only...`,
        image: `Analyzing link and extracting STATIC creatives only...`,
      };
      setProcessingMessage(typeMessages[selectedCreativeType]);
      setShowAINewsModal(true);
      setIsLoading(true);

      try {
        const response = await fetch('/api/parse-meta-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metaLink: searchValue, creativeType: selectedCreativeType }),
        });
        const result = await response.json();

        if (result.success) {
          const successMessages = {
            all: `Successfully processed link! New ads (video & static) will appear shortly.`,
            video: `Successfully processed link! New video ads will appear shortly.`,
            image: `Successfully processed link! New static ads will appear shortly.`,
          };
          setProcessingMessage(successMessages[selectedCreativeType]);
          // Keep the modal open and instruct the user to refresh to see new ads
          setProcessingDone(true);
        } else {
          setShowAINewsModal(false);
          alert(`Error processing link:\n\n${result.message || result.error}`);
        }
      } catch (error: unknown) {
        setShowAINewsModal(false);
        const message = error instanceof Error ? error.message : 'Unknown error';
        alert('Error: ' + message);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(true);
      try {
        const raw = await getAds(
          searchValue || undefined,
          null,
          null,
          selectedTags.length ? selectedTags : undefined
        );
        const filtered: Ad[] = extractDataArray(raw);
        const final =
          selectedCreativeType === 'all'
            ? filtered
            : filtered.filter((ad) =>
                selectedCreativeType === 'video'
                  ? ad.display_format === 'VIDEO'
                  : ad.display_format === 'IMAGE'
              );
        setAds(final);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error filtering ads:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [productFilter, selectedTags, selectedCreativeType]);

  const videoAds = useMemo(
    () => filteredAdsByType.filter((ad) => ad.display_format === 'VIDEO').length,
    [filteredAdsByType]
  );

  const searchTimeout = useRef<number | null>(null);

  const handleProductFilterChange = useCallback(
    (value: string) => {
      setProductFilter(value);

      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
        searchTimeout.current = null;
      }

      const id = window.setTimeout(async () => {
        setIsLoading(true);
        try {
          const raw = await getAds(
            value || undefined,
            null,
            null,
            selectedTags.length > 0 ? selectedTags : undefined
          );
          const filtered: Ad[] = extractDataArray(raw);
          const final =
            selectedCreativeType === 'all'
              ? filtered
              : filtered.filter((ad) =>
                  selectedCreativeType === 'video'
                    ? ad.display_format === 'VIDEO'
                    : ad.display_format === 'IMAGE'
                );
          setAds(final);
          setCurrentPage(1);
        } catch (error) {
          console.error('Error filtering ads:', error);
        } finally {
          setIsLoading(false);
        }
      }, 300);
      searchTimeout.current = id;
    },
    [selectedTags]
  );

  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  const clearProductFilter = useCallback(async () => {
    setProductFilter('');
    setIsLoading(true);
    try {
      const raw = await getAds('', null, null, selectedTags);
      const allAds: Ad[] = extractDataArray(raw);
      setAds(allAds);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading ads:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTags]);

  // Polling: periodically refresh ads from the server when no heavy operation is underway.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pollIntervalMs || pollIntervalMs <= 0) return;

    let mounted = true;
    const doPoll = async () => {
      if (!mounted) return;
      if (isLoading) return; // avoid overlapping fetches
      console.log('[Poll] Head-check: checking for new ads...');
      try {
        setIsLoading(true);
        const res = await fetch('/api/ads/head');
        if (!res.ok) {
          console.warn('[Poll] Head-check failed, falling back to full fetch');
          // fallback to full fetch once
          const raw = await getAds(
            productFilter || undefined,
            null,
            null,
            selectedTags && selectedTags.length > 0 ? selectedTags : undefined
          );
          const fetched: Ad[] = extractDataArray(raw);
          const final =
            selectedCreativeType === 'all'
              ? fetched
              : fetched.filter((ad) =>
                  selectedCreativeType === 'video'
                    ? ad.display_format === 'VIDEO'
                    : ad.display_format === 'IMAGE'
                );
          // only update when non-empty
          if (final.length > 0) {
            setAds(final);
            setCurrentPage(1);
          } else {
            console.warn('[Poll] Full fetch returned empty — keeping current ads');
          }
        } else {
          const head = await res.json();
          const headCount = typeof head.count === 'number' ? head.count : null;
          const headLatest = head.latest_created_at || null;

          // determine if head changed
          const currentLatest = ads.length > 0 ? (ads[0].created_at as string | null) : null;
          const currentCount = typeof initialTotalAds === 'number' ? initialTotalAds : ads.length;

          const changed =
            (headCount !== null && headCount !== currentCount) ||
            (headLatest && headLatest !== currentLatest);

          console.log(`[Poll] head count=${headCount} latest=${headLatest} changed=${changed}`);

          if (changed) {
            // fetch full data
            const raw = await getAds(
              productFilter || undefined,
              null,
              null,
              selectedTags && selectedTags.length > 0 ? selectedTags : undefined
            );
            const fetched: Ad[] = extractDataArray(raw);
            const final =
              selectedCreativeType === 'all'
                ? fetched
                : fetched.filter((ad) =>
                    selectedCreativeType === 'video'
                      ? ad.display_format === 'VIDEO'
                      : ad.display_format === 'IMAGE'
                  );

            if (final.length === 0 && ads.length > 0) {
              console.warn(
                '[Poll] Full fetch after head-change returned 0 ads — keeping current ads'
              );
            } else {
              const currentIds = new Set(ads.map((a) => String(a.id)));
              const fetchedIds = new Set(final.map((a) => String(a.id)));
              let isDifferent = false;
              if (currentIds.size !== fetchedIds.size) isDifferent = true;
              else {
                for (const id of currentIds) {
                  if (!fetchedIds.has(id)) {
                    isDifferent = true;
                    break;
                  }
                }
              }

              if (isDifferent) {
                const added = final.filter((a) => !currentIds.has(String(a.id))).length;
                setAds(final);
                if (added > 0) setCurrentPage(1);
              }
            }
          }
        }
      } catch (e) {
        console.error('Polling head-check error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    // run first poll after a short delay so initial render is stable
    const firstTimeout = window.setTimeout(() => {
      doPoll();
    }, 1000);

    const id = window.setInterval(doPoll, pollIntervalMs);

    // Also poll when user focuses the window, when tab becomes visible again,
    // or when history navigation occurs (popstate). These actions indicate
    // user activity or a navigation that may require a fresh head-check.
    const onFocus = () => {
      try {
        doPoll();
      } catch (e) {
        console.debug('focus poll error', e);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        try {
          doPoll();
        } catch (e) {
          console.debug('visibility poll error', e);
        }
      }
    };

    const onPopstate = () => {
      try {
        doPoll();
      } catch (e) {
        console.debug('popstate poll error', e);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('popstate', onPopstate);

    return () => {
      mounted = false;
      window.clearTimeout(firstTimeout);
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('popstate', onPopstate);
    };
    // Intentionally include key deps so polling reacts to filter changes
  }, [pollIntervalMs, productFilter, selectedTags, selectedCreativeType]);

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
    availableTags,
    filteredAdsByType,
    adIdToGroupMap,
    ungroupedPages,
    totalPages,
    currentPageAds,
    currentPageAdsCount,
    visibleAdsCount,
    totalAds,
    handlePageChange,
    handleFilterChange,
    handleTagsChange,
    handleSearch,
    handleProductFilterChange,
    clearProductFilter,
    videoAds,
    processingDone,
    setProcessingDone,
  };
}

export type UseAdArchiveReturn = ReturnType<typeof useAdArchive>;

export default useAdArchive;
