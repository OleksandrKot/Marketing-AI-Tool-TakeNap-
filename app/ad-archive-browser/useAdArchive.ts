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

export function useAdArchive(
  initialAds: Ad[],
  initialFilters?: FilterOptions,
  initialTotalAds?: number,
  pollIntervalMs: number = 60 * 1000
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
  const [numberToScrape, setNumberToScrape] = useState<number>(10);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importSavedCreatives, setImportSavedCreatives] = useState<number | null>(null);
  const [importTotalCreatives, setImportTotalCreatives] = useState<number | null>(null);
  const [autoClearProcessing, setAutoClearProcessing] = useState<boolean>(true);
  const [userSortMode, setUserSortMode] = useState<
    'auto' | 'most_variations' | 'least_variations' | 'newest'
  >('auto');
  const [lastFilterChange, setLastFilterChange] = useState<number>(0);
  const jobChannelRef = useRef<ReturnType<(typeof supabase)['channel']> | null>(null);
  const clearDisplayTimeoutRef = useRef<number | null>(null);
  const searchTimeout = useRef<number | null>(null);
  const isLoadingRef = useRef<boolean>(false);

  const [requestLogs, setRequestLogs] = useState<
    Array<{
      id: string;
      time: string;
      type?: string;
      text?: string;
      meta?: Record<string, unknown>;
    }>
  >([]);

  const clearRequestLogs = useCallback(() => {
    try {
      setRequestLogs([]);
    } catch (e) {
      console.debug('clearRequestLogs error', e);
    }
  }, []);

  const scheduleClearDisplay = useCallback(
    (delay = 6000) => {
      if (!autoClearProcessing) return;
      try {
        if (clearDisplayTimeoutRef.current) {
          window.clearTimeout(clearDisplayTimeoutRef.current);
          clearDisplayTimeoutRef.current = null;
        }
        clearDisplayTimeoutRef.current = window.setTimeout(() => {
          setProcessingMessage('');
          setImportStatus(null);
          setImportSavedCreatives(null);
          setImportTotalCreatives(null);
          setProcessingDone(false);
          setImportJobId(null);
          clearDisplayTimeoutRef.current = null;
        }, delay) as unknown as number;
      } catch (e) {
        console.debug('scheduleClearDisplay error', e);
      }
    },
    [autoClearProcessing]
  );

  const clearScheduledDisplay = useCallback(() => {
    try {
      if (clearDisplayTimeoutRef.current) {
        window.clearTimeout(clearDisplayTimeoutRef.current);
        clearDisplayTimeoutRef.current = null;
      }
    } catch (e) {
      console.debug('clearScheduledDisplay error', e);
    }
  }, []);

  const clearProcessingDisplay = useCallback(() => {
    try {
      if (clearDisplayTimeoutRef.current) {
        window.clearTimeout(clearDisplayTimeoutRef.current);
        clearDisplayTimeoutRef.current = null;
      }
      setProcessingMessage('');
      setImportStatus(null);
      setImportSavedCreatives(null);
      setImportTotalCreatives(null);
      setProcessingDone(false);
      setImportJobId(null);

      try {
        jobChannelRef.current?.unsubscribe();
      } catch (e) {
        console.debug('Error unsubscribing job channel during clear', e);
      }
    } catch (e) {
      console.debug('clearProcessingDisplay error', e);
    }
  }, []);

  const pushRequestLog = useCallback(
    (entry?: { type?: string; text?: string; meta?: Record<string, unknown> }) => {
      try {
        setRequestLogs((prev) => {
          const next = [
            ...prev,
            {
              id: `${Date.now()}_${Math.floor(Math.random() * 100000)}`,
              time: new Date().toISOString(),
              ...(entry ?? {}),
            },
          ];
          return next.slice(-500);
        });

        try {
          if (entry?.type === 'status') {
            if (typeof entry.text === 'string' && entry.text.trim() !== '') {
              setProcessingMessage(String(entry.text));
              clearScheduledDisplay();
            }
            const meta = entry.meta ?? {};
            if (meta && typeof meta === 'object') {
              const maybeStatus = (meta as Record<string, unknown>)['status'];
              if (typeof maybeStatus === 'string') setImportStatus(maybeStatus);
              const maybeJob = (meta as Record<string, unknown>)['job_id'];
              if (typeof maybeJob === 'string') setImportJobId(maybeJob);
              const maybeSaved = (meta as Record<string, unknown>)['saved_creatives'];
              if (typeof maybeSaved === 'number') setImportSavedCreatives(maybeSaved);
              const maybeTotal = (meta as Record<string, unknown>)['total_creatives'];
              if (typeof maybeTotal === 'number') setImportTotalCreatives(maybeTotal);
            }
          }
        } catch (e) {
          console.debug('pushRequestLog: mirror to import status failed', e);
        }
      } catch (e) {
        console.debug('pushRequestLog error', e);
      }
    },
    [clearScheduledDisplay]
  );

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    let userChannel: ReturnType<(typeof supabase)['channel']> | null = null;
    let mounted = true;

    (async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const uid = userRes?.data?.user?.id ?? null;
        if (!uid) return;

        try {
          userChannel = supabase
            .channel(`import-status-user-${uid}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'import_status', filter: `user_id=eq.${uid}` },
              (payload: unknown) => {
                try {
                  const row = utils.getRowFromPayload(payload);
                  if (!row) return;
                  const message = row['message'];
                  if (typeof message === 'string') {
                    setProcessingMessage(String(message));
                    clearScheduledDisplay();
                    try {
                      pushRequestLog({
                        type: 'status',
                        text: String(message),
                        meta: { source: 'user_subscription' },
                      });
                    } catch (e) {
                      /* noop */
                    }
                  }
                  const status = row['status'];
                  if (typeof status === 'string') setImportStatus(status);
                  const saved = row['saved_creatives'];
                  if (typeof saved === 'number') setImportSavedCreatives(saved);
                  const total = row['total_creatives'];
                  if (typeof total === 'number') setImportTotalCreatives(total);
                  const jobId = row['job_id'];
                  if (typeof jobId === 'string') setImportJobId(jobId);
                } catch (e) {
                  console.debug('Error handling user import_status payload', e);
                }
              }
            )
            .subscribe();
        } catch (e) {
          console.debug('Could not create user import_status subscription', e);
          userChannel = null;
        }

        try {
          const { data: latest, error: latestErr } = await supabase
            .from('import_status')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestErr) {
            console.debug('Error fetching latest import_status for user', latestErr);
          } else if (latest && mounted) {
            if (latest.message) {
              setProcessingMessage(String(latest.message));
              clearScheduledDisplay();
              try {
                pushRequestLog({
                  type: 'status',
                  text: String(latest.message),
                  meta: { source: 'user_initial_fetch' },
                });
              } catch (e) {
                /* noop */
              }
            }
            if (latest.status) setImportStatus(latest.status);
            if (typeof latest.saved_creatives === 'number')
              setImportSavedCreatives(latest.saved_creatives);
            if (typeof latest.total_creatives === 'number')
              setImportTotalCreatives(latest.total_creatives);
            if (latest.job_id) setImportJobId(latest.job_id);
            if (latest.status === 'done' || latest.status === 'error') {
              setProcessingDone(true);
              scheduleClearDisplay(6000);
            }
          }
        } catch (e) {
          console.debug('Exception reading latest import_status for user', e);
        }
      } catch (e) {
        console.debug('Error initializing user import_status subscription', e);
      }
    })();

    return () => {
      mounted = false;
      try {
        userChannel?.unsubscribe();
      } catch (e) {
        console.debug('Error unsubscribing user import_status channel', e);
      }
      try {
        jobChannelRef.current?.unsubscribe();
      } catch (e) {
        console.debug('Error unsubscribing job channel on unmount', e);
      }
    };
  }, [clearScheduledDisplay, pushRequestLog, scheduleClearDisplay]);

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
    // Build groups only from DB-provided duplicate links. All other ads remain
    // as singletons (no global grouping by phash/image/text).
    const n = filteredAdsByType.length;
    const idToIndex = new Map<number, number>();
    const archiveIdToIndex = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const a = filteredAdsByType[i];
      idToIndex.set(Number(a.id), i);
      if (a.ad_archive_id) archiveIdToIndex.set(String(a.ad_archive_id), i);
    }

    const parent = new Array<number>(n).fill(0).map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) return;
      parent[rb] = ra;
    };

    const tryResolveTokenToIndex = (token: string): number | null => {
      const t = String(token).trim();
      if (t.length === 0) return null;
      // numeric id match
      const asNum = Number(t);
      if (Number.isFinite(asNum) && idToIndex.has(asNum)) return idToIndex.get(asNum) ?? null;
      // ad_archive_id match
      if (archiveIdToIndex.has(t)) return archiveIdToIndex.get(t) ?? null;
      // ad_archive_id substring match (common when token is a URL)
      for (const [aid, idx] of archiveIdToIndex.entries()) {
        if (t.includes(aid)) return idx;
      }
      return null;
    };

    for (let i = 0; i < n; i++) {
      const a = filteredAdsByType[i];
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

    const map = new Map<string, Ad[]>();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      const key = String(filteredAdsByType[r].id ?? r);
      const arr = map.get(key) ?? [];
      arr.push(filteredAdsByType[i]);
      map.set(key, arr);
    }
    return map;
  }, [filteredAdsByType]);

  const PHASH_GROUP_COLLAPSE_THRESHOLD = 2;
  const PHASH_GROUP_MAX_COLLAPSE = 15;
  // Hamming distance threshold for phash clustering. Lower = stricter (only
  // very similar images cluster). Increase only if you want more merging.
  // For 8x8 hashes max distance is 64; a value around 6-10 is typical.
  const PHASH_HAMMING_THRESHOLD = 6;

  const dedupedAds = useMemo(() => {
    if (!filteredAdsByType || filteredAdsByType.length === 0) return [] as Ad[];

    // Use duplicate-based groups computed above
    const adIdToGroupLocal = new Map<string, Ad[]>();
    groupedAll.forEach((g) => {
      for (const a of g) adIdToGroupLocal.set(String(a.id), g);
    });

    // const phashKeys = Array.from(groupMap.keys()).filter((k) => k.startsWith('phash:'));

    // pHash-based clustering/sorting temporarily disabled — keep code for reference
    // try {
    //   console.debug(
    //     '[useAdArchive] PHASH_HAMMING_THRESHOLD=',
    //     PHASH_HAMMING_THRESHOLD,
    //     'PHASH_GROUP_COLLAPSE_THRESHOLD=',
    //     PHASH_GROUP_COLLAPSE_THRESHOLD,
    //     'phashKeysCount=',
    //     phashKeys.length
    //   );
    // } catch (e) {
    //   /* noop */
    // }

    // const { phashClusters, keyToRep } = utils.buildPhashClustersFromKeys(
    //   phashKeys,
    //   groupMap,
    //   PHASH_HAMMING_THRESHOLD
    // );

    // Use empty stubs so downstream logic treats items as non-phash clustered
    // const phashClusters = new Map<string, string[]>();
    // const keyToRep = new Map<string, string>();

    const seenGroup = new Set<string>();
    const out: Ad[] = [];
    for (const ad of filteredAdsByType) {
      const group = adIdToGroupLocal.get(String(ad.id)) ?? [ad];
      const mapped = String(group[0]?.id ?? ad.id);
      if (seenGroup.has(mapped)) continue;
      // let effectiveSize = group.length; // kept for reference
      // pHash clustering is disabled — keep original logic commented for reference
      // if (mapped !== key) {
      //   const keysInCluster = phashClusters.get(mapped) ?? [];
      //   effectiveSize = keysInCluster.reduce((sum, kk) => sum + (groupMap.get(kk)?.length ?? 0), 0);
      // }

      // const isPhashBased = mapped.startsWith('phash:');
      // const shouldCollapse = isPhashBased
      //   ? effectiveSize >= PHASH_GROUP_COLLAPSE_THRESHOLD &&
      //     effectiveSize <= PHASH_GROUP_MAX_COLLAPSE
      //   : group.length > 1;
      const shouldCollapse = group.length > 1;

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

    return out;
  }, [
    filteredAdsByType,
    PHASH_GROUP_COLLAPSE_THRESHOLD,
    PHASH_GROUP_MAX_COLLAPSE,
    PHASH_HAMMING_THRESHOLD,
  ]);

  const adIdToRelatedCount: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    if (!filteredAdsByType || filteredAdsByType.length === 0) return out;

    // Compute related counts from duplicate-based groups
    const adIdToGroupLocal = new Map<string, Ad[]>();
    groupedAll.forEach((g) => {
      for (const a of g) adIdToGroupLocal.set(String(a.id), g);
    });

    for (const ad of filteredAdsByType) {
      const group = adIdToGroupLocal.get(String(ad.id)) ?? [ad];
      out[ad.id] = Math.max(0, group.length - 1);
    }

    return out;
  }, [filteredAdsByType, PHASH_HAMMING_THRESHOLD, PHASH_GROUP_MAX_COLLAPSE]);

  // adIdToRelatedCount is now available; create a sorted copy of dedupedAds
  // so we can sort by variations.
  const sortedDedupedAds = useMemo(() => {
    try {
      const arr = [...dedupedAds];
      const effectiveMode = (() => {
        if (userSortMode === 'auto') {
          // If any filter was applied recently, auto-sort by most variations; otherwise newest
          return lastFilterChange > 0 ? 'most_variations' : 'newest';
        }
        return userSortMode;
      })();

      if (effectiveMode === 'most_variations') {
        const sorted = arr.sort((a, b) => {
          const na = adIdToRelatedCount[a.id] ?? 0;
          const nb = adIdToRelatedCount[b.id] ?? 0;
          if (nb !== na) return nb - na;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        try {
          if (typeof window !== 'undefined') {
            console.debug(
              '[useAdArchive] sort=most_variations top=',
              sorted
                .slice(0, 8)
                .map((x) => ({ id: x.id, variations: adIdToRelatedCount[x.id] ?? 0 }))
            );
          }
        } catch (e) {
          /* noop */
        }
        return sorted;
      }

      if (effectiveMode === 'least_variations') {
        const sorted = arr.sort((a, b) => {
          const na = adIdToRelatedCount[a.id] ?? 0;
          const nb = adIdToRelatedCount[b.id] ?? 0;
          if (na !== nb) return na - nb;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        try {
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.debug(
              '[useAdArchive] sort=least_variations top=',
              sorted
                .slice(0, 8)
                .map((x) => ({ id: x.id, variations: adIdToRelatedCount[x.id] ?? 0 }))
            );
          }
        } catch (e) {
          /* noop */
        }
        return sorted;
      }

      // newest
      const sorted = arr.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      try {
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line no-console
          console.debug(
            '[useAdArchive] sort=newest top=',
            sorted.slice(0, 8).map((x) => ({ id: x.id, variations: adIdToRelatedCount[x.id] ?? 0 }))
          );
        }
      } catch (e) {
        /* noop */
      }
      return sorted;
    } catch (e) {
      return dedupedAds;
    }
  }, [dedupedAds, userSortMode, lastFilterChange, adIdToRelatedCount]);

  // Debug helper: log sort mode and a small sample of counts/order when relevant changes occur
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      // Prepare small samples
      const sampleCounts = Object.keys(adIdToRelatedCount)
        .slice(0, 12)
        .map((k) => ({ id: k, count: adIdToRelatedCount[k] }));
      // eslint-disable-next-line no-console
      console.debug(
        '[useAdArchive DEBUG] userSortMode=',
        userSortMode,
        'lastFilterChange=',
        lastFilterChange,
        'sampleCounts=',
        sampleCounts
      );
    } catch (e) {
      /* noop */
    }
  }, [userSortMode, lastFilterChange, adIdToRelatedCount]);

  const adIdToGroupMap: Record<string, Ad[]> = useMemo(() => {
    const out: Record<string, Ad[]> = {};
    groupedAll.forEach((groupAds) => {
      for (const ad of groupAds) out[ad.id] = groupAds;
    });
    return out;
  }, [groupedAll]);

  const ungroupedPages = useMemo(
    () => utils.chunk(sortedDedupedAds, itemsPerPage),
    [sortedDedupedAds, itemsPerPage]
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

  // When sort mode changes, reset to first page so users see top results immediately.
  useEffect(() => {
    try {
      setCurrentPage(1);
    } catch (e) {
      /* noop */
    }
  }, [userSortMode]);

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

  const totalAds = typeof initialTotalAds === 'number' ? initialTotalAds : dedupedAds.length;

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages]
  );

  const handleFilterChange = useCallback(
    async (filters: FilterOptions) => {
      setLastFilterChange(Date.now());
      setIsLoading(true);
      try {
        const raw = await getAds(
          filters.search,
          filters.page,
          filters.date,
          filters.tags,
          filters.publisherPlatform
        );
        const fetched: Ad[] = utils.extractDataArray(raw);
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
    },
    [selectedCreativeType]
  );

  const handleTagsChange = useCallback(
    async (tags: string[]) => {
      setSelectedTags(tags);
      setLastFilterChange(Date.now());
      setIsLoading(true);
      try {
        const raw = await getAds(productFilter || '', null, null, tags);
        const filtered: Ad[] = utils.extractDataArray(raw);
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
    [productFilter, selectedCreativeType]
  );

  const handleSearch = useCallback(async () => {
    const searchValue = productFilter.trim();

    if (!searchValue && selectedTags.length === 0) {
      try {
        const raw = await getAds(undefined, null, null, undefined);
        const allAds: Ad[] = utils.extractDataArray(raw);
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
        let userId: string | null = null;
        try {
          const userRes = await supabase.auth.getUser();
          userId = userRes?.data?.user?.id ?? null;
        } catch (e) {
          console.debug('Could not get supabase user id for parse request', e);
        }

        let jobId: string;
        try {
          const cryptoAny = globalThis.crypto as unknown as { randomUUID?: () => string };
          if (cryptoAny && typeof cryptoAny.randomUUID === 'function') {
            jobId = cryptoAny.randomUUID();
          } else {
            jobId = `job_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
          }
        } catch (e) {
          jobId = `job_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        }

        let channel: ReturnType<(typeof supabase)['channel']> | null = null;
        try {
          channel = supabase
            .channel(`import-status-${jobId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'import_status',
                filter: `job_id=eq.${jobId}`,
              },
              (payload: unknown) => {
                try {
                  const row = utils.getRowFromPayload(payload);
                  if (!row) return;
                  const maybeUserId = row['user_id'];
                  if (userId && maybeUserId && String(maybeUserId) !== String(userId)) return;
                  const message = row['message'];
                  if (typeof message === 'string') {
                    setProcessingMessage(String(message));
                    try {
                      pushRequestLog({
                        type: 'status',
                        text: String(message),
                        meta: { source: 'job_subscription' },
                      });
                    } catch (e) {
                      /* noop */
                    }
                  }
                  const status = row['status'];
                  if (typeof status === 'string') setImportStatus(status);
                  const saved = row['saved_creatives'];
                  if (typeof saved === 'number') setImportSavedCreatives(saved);
                  const total = row['total_creatives'];
                  if (typeof total === 'number') setImportTotalCreatives(total);
                  const jobIdFromRow = row['job_id'];
                  if (typeof jobIdFromRow === 'string') setImportJobId(jobIdFromRow);

                  if (status === 'done' || status === 'error') {
                    setProcessingDone(true);
                    scheduleClearDisplay(6000);
                    try {
                      channel?.unsubscribe();
                    } catch (e) {
                      console.debug('Error unsubscribing import-status channel', e);
                    }
                  }
                } catch (e) {
                  console.debug('Error handling import_status payload', e);
                }
              }
            )
            .subscribe();
        } catch (e) {
          console.debug('Could not create import_status subscription', e);
          channel = null;
        }

        console.debug('[AdArchive] starting parse, jobId=', jobId, 'userId=', userId);
        setProcessingMessage('Creatives loading from Meta Ad Library  ...');
        setShowAINewsModal(false);
        setProcessingDone(false);

        const response = await fetch('/api/parse-meta-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metaLink: searchValue,
            creativeType: selectedCreativeType,
            limit: numberToScrape,
            user_id: userId,
            job_id: jobId,
          }),
        });
        let result: unknown = null;
        try {
          result = await response.json();
        } catch (e) {
          result = { success: response.ok, error: 'Invalid JSON response' } as Record<
            string,
            unknown
          >;
        }

        setImportJobId(jobId);

        if (channel) jobChannelRef.current = channel;

        try {
          const { data: existing, error: existingErr } = await supabase
            .from('import_status')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingErr) {
            console.debug('Error fetching initial import_status row', existingErr);
          } else if (existing) {
            if (existing.message) {
              setProcessingMessage(String(existing.message));
              clearScheduledDisplay();
            }
            if (existing.status) setImportStatus(existing.status);
            if (typeof existing.saved_creatives === 'number')
              setImportSavedCreatives(existing.saved_creatives);
            if (typeof existing.total_creatives === 'number')
              setImportTotalCreatives(existing.total_creatives);
            if (existing.status === 'done' || existing.status === 'error') {
              setProcessingDone(true);
              scheduleClearDisplay(6000);
            }
          }
        } catch (e) {
          console.debug('Exception reading initial import_status', e);
        }

        const resultObj =
          result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
        if (resultObj && resultObj['success'] === true) {
        } else {
          const errMsg = resultObj
            ? String(resultObj['message'] ?? resultObj['error'] ?? 'Unknown error from webhook')
            : 'Unknown error from webhook';
          setProcessingMessage(`Error: ${errMsg}`);
          setImportStatus('error');
          setProcessingDone(true);
        }
      } catch (error: unknown) {
        setShowAINewsModal(true);
        const message = error instanceof Error ? error.message : 'Unknown error';
        setProcessingMessage('Error: ' + message);
        setImportStatus('error');
        setProcessingDone(true);
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
        const filtered: Ad[] = utils.extractDataArray(raw);
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
  }, [
    productFilter,
    selectedTags,
    selectedCreativeType,
    numberToScrape,
    scheduleClearDisplay,
    pushRequestLog,
  ]);

  const videoAds = useMemo(
    () => dedupedAds.filter((ad) => ad.display_format === 'VIDEO').length,
    [dedupedAds]
  );

  const handleProductFilterChange = useCallback(
    (value: string) => {
      setProductFilter(value);

      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
        searchTimeout.current = null;
      }

      const id = window.setTimeout(async () => {
        setLastFilterChange(Date.now());
        setIsLoading(true);
        try {
          const raw = await getAds(
            value || undefined,
            null,
            null,
            selectedTags.length > 0 ? selectedTags : undefined
          );
          const filtered: Ad[] = utils.extractDataArray(raw);
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
    [selectedTags, selectedCreativeType]
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
      const allAds: Ad[] = utils.extractDataArray(raw);
      setAds(allAds);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading ads:', error);
    } finally {
      setIsLoading(false);
      try {
        window.dispatchEvent(new CustomEvent('productFilterCleared'));
      } catch (e) {}
    }
  }, [selectedTags]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pollIntervalMs || pollIntervalMs <= 0) return;

    let mounted = true;
    const doPoll = async () => {
      if (!mounted) return;
      if (isLoadingRef.current) return;

      try {
        setIsLoading(true);
        const res = await fetch('/api/ads/head');
        if (!res.ok) {
          console.warn('[Poll] Head-check failed, falling back to full fetch');
          const raw = await getAds(
            productFilter || undefined,
            null,
            null,
            selectedTags && selectedTags.length > 0 ? selectedTags : undefined
          );
          const fetched: Ad[] = utils.extractDataArray(raw);
          const final =
            selectedCreativeType === 'all'
              ? fetched
              : fetched.filter((ad) =>
                  selectedCreativeType === 'video'
                    ? ad.display_format === 'VIDEO'
                    : ad.display_format === 'IMAGE'
                );
          if (final.length > 0) {
            setAds(final);
            setCurrentPage(1);
          } else {
            console.warn('[Poll] Full fetch returned empty — keeping current ads');
          }
        } else {
          const head = await res.json();
          const headPresent = typeof head.present === 'number' ? head.present : null;

          const currentCount = typeof initialTotalAds === 'number' ? initialTotalAds : ads.length;
          const changed = headPresent !== null && headPresent !== currentCount;

          if (changed) {
            const raw = await getAds(
              productFilter || undefined,
              null,
              null,
              selectedTags && selectedTags.length > 0 ? selectedTags : undefined
            );
            const fetched: Ad[] = utils.extractDataArray(raw);
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
      // Additionally, check whether there are any rows missing `creative_hash` and trigger worker if needed.
      try {
        // Throttle client-side to avoid spamming the endpoint: store last trigger in ref
        const last = window.__lastPhashCheck ?? 0;
        const now = Date.now();
        // call at most once per poll interval from client
        if (now - last > Math.max(0, pollIntervalMs)) {
          window.__lastPhashCheck = now;
          try {
            await fetch('/api/ads/check-phash');
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        /* ignore */
      }
    };

    const firstTimeout = window.setTimeout(() => {
      doPoll();
    }, 1000);

    const id = window.setInterval(doPoll, pollIntervalMs);

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
  }, [
    pollIntervalMs,
    productFilter,
    selectedTags,
    selectedCreativeType,
    initialTotalAds,
    ads.length,
  ]);

  useEffect(() => {
    const handler = async () => {
      try {
        setIsLoading(true);
        const raw = await getAds(
          productFilter || undefined,
          null,
          null,
          selectedTags && selectedTags.length > 0 ? selectedTags : undefined
        );
        const fetched: Ad[] = utils.extractDataArray(raw);
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
      } catch (e) {
        console.error('Error during soft refresh:', e);
      } finally {
        setIsLoading(false);
      }
    };

    const listener = () => handler();
    window.addEventListener('app:refresh', listener as EventListener);
    return () => {
      try {
        window.removeEventListener('app:refresh', listener as EventListener);
      } catch (e) {}
    };
  }, [productFilter, selectedTags, selectedCreativeType]);

  const subscribeToJob = useCallback(async (jobId: string, userId?: string | null) => {
    if (!jobId) return;

    try {
      jobChannelRef.current?.unsubscribe();
    } catch (e) {
      console.debug('Error unsubscribing previous job channel', e);
    }

    try {
      const { data: existing, error: existingErr } = await supabase
        .from('import_status')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingErr) {
        console.debug('Error fetching import_status row for subscribeToJob', existingErr);
      } else if (existing) {
        if (existing.message) {
          setProcessingMessage(String(existing.message));
        }
        if (existing.status) setImportStatus(existing.status);
        if (typeof existing.saved_creatives === 'number')
          setImportSavedCreatives(existing.saved_creatives);
        if (typeof existing.total_creatives === 'number')
          setImportTotalCreatives(existing.total_creatives);
        if (existing.job_id) setImportJobId(existing.job_id);
      }
    } catch (e) {
      console.debug('Exception reading import_status in subscribeToJob', e);
    }

    try {
      const channel = supabase
        .channel(`import-status-sub-${jobId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'import_status', filter: `job_id=eq.${jobId}` },
          (payload: unknown) => {
            try {
              const row = utils.getRowFromPayload(payload);
              if (!row) return;
              const maybeUserId = row['user_id'];
              if (userId && maybeUserId && String(maybeUserId) !== String(userId)) return;
              const message = row['message'];
              if (typeof message === 'string') {
                setProcessingMessage(String(message));
              }
              const status = row['status'];
              if (typeof status === 'string') setImportStatus(status);
              const saved = row['saved_creatives'];
              if (typeof saved === 'number') setImportSavedCreatives(saved);
              const total = row['total_creatives'];
              if (typeof total === 'number') setImportTotalCreatives(total);
              const jobIdFromRow = row['job_id'];
              if (typeof jobIdFromRow === 'string') setImportJobId(jobIdFromRow);
            } catch (e) {
              console.debug('Error handling subscribeToJob payload', e);
            }
          }
        )
        .subscribe();

      jobChannelRef.current = channel;
    } catch (e) {
      console.debug('Could not create job import_status subscription', e);
    }
  }, []);

  // Auto-subscribe to a job-specific import_status channel when importJobId becomes available.
  useEffect(() => {
    try {
      if (!importJobId) return;
      // attempt to get current user id and subscribe to job channel scoped to user
      (async () => {
        try {
          const userRes = await supabase.auth.getUser();
          const uid = userRes?.data?.user?.id ?? null;
          await subscribeToJob(importJobId, uid);
        } catch (e) {
          // fallback: subscribe without user id filter
          try {
            await subscribeToJob(importJobId);
          } catch (err) {
            console.debug('Auto subscribeToJob failed', err);
          }
        }
      })();
    } catch (e) {
      console.debug('Auto-subscribe effect error', e);
    }
    // intentionally only when importJobId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importJobId]);

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
    adIdToRelatedCount,
    userSortMode,
    setUserSortMode,
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
    numberToScrape,
    setNumberToScrape,
    importJobId,
    importStatus,
    importSavedCreatives,
    importTotalCreatives,
    autoClearProcessing,
    setAutoClearProcessing,
    requestLogs,
    clearRequestLogs,
    clearProcessingDisplay,
    subscribeToJob,
  };
}

export type UseAdArchiveReturn = ReturnType<typeof useAdArchive>;

export default useAdArchive;
