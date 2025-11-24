'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/core/supabase';
import type { Ad, FilterOptions, ViewMode } from '@/lib/core/types';
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
  const [numberToScrape, setNumberToScrape] = useState<number>(10);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importSavedCreatives, setImportSavedCreatives] = useState<number | null>(null);
  const [importTotalCreatives, setImportTotalCreatives] = useState<number | null>(null);
  const [autoClearProcessing, setAutoClearProcessing] = useState<boolean>(true);
  // lightweight request logs (shown in UI as stacked entries)
  const [requestLogs, setRequestLogs] = useState<
    Array<{
      id: string;
      time: string;
      type?: string;
      text?: string;
      meta?: Record<string, unknown>;
    }>
  >([]);

  const pushRequestLog = useCallback(
    (entry: { type?: string; text?: string; meta?: Record<string, unknown> }) => {
      try {
        setRequestLogs((prev) => {
          const next = [
            ...prev,
            {
              id: `${Date.now()}_${Math.floor(Math.random() * 100000)}`,
              time: new Date().toISOString(),
              ...entry,
            },
          ];
          return next.slice(-500);
        });
        // If this is a status-type log, reflect it in the import status UI as well
        try {
          if (entry?.type === 'status') {
            if (typeof entry.text === 'string' && entry.text.trim() !== '') {
              setProcessingMessage(String(entry.text));
              // new activity — cancel any scheduled clear
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
    []
  );
  const clearRequestLogs = useCallback(() => {
    try {
      setRequestLogs([]);
    } catch (e) {
      console.debug('clearRequestLogs error', e);
    }
  }, []);
  const jobChannelRef = useRef<ReturnType<(typeof supabase)['channel']> | null>(null);
  const clearDisplayTimeoutRef = useRef<number | null>(null);

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
      // cancel any scheduled clear
      if (clearDisplayTimeoutRef.current) {
        window.clearTimeout(clearDisplayTimeoutRef.current);
        clearDisplayTimeoutRef.current = null;
      }
      // reset processing-related state
      setProcessingMessage('');
      setImportStatus(null);
      setImportSavedCreatives(null);
      setImportTotalCreatives(null);
      setProcessingDone(false);
      setImportJobId(null);

      // unsubscribe job-specific channel if present
      try {
        jobChannelRef.current?.unsubscribe();
      } catch (e) {
        console.debug('Error unsubscribing job channel during clear', e);
      }
    } catch (e) {
      console.debug('clearProcessingDisplay error', e);
    }
  }, []);

  // Persistent user-level realtime subscription. This listens for any import_status
  // changes for the currently-authenticated user so the UI shows imports started
  // by other tabs or earlier runs as well.
  useEffect(() => {
    let userChannel: ReturnType<(typeof supabase)['channel']> | null = null;
    let mounted = true;

    (async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const uid = userRes?.data?.user?.id ?? null;
        if (!uid) return;

        // Create user-level channel
        try {
          userChannel = supabase
            .channel(`import-status-user-${uid}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'import_status', filter: `user_id=eq.${uid}` },
              (payload: unknown) => {
                try {
                  const row = getRowFromPayload(payload);
                  if (!row) return;
                  const message = row['message'];
                  if (typeof message === 'string') {
                    setProcessingMessage((prev) => prev || message);
                    // new activity — cancel any scheduled clear
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

        // Read the latest import_status row for this user so UI can show current state immediately
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
              setProcessingMessage((prev) => prev || latest.message);
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
        // cleanup any job-specific channel
        jobChannelRef.current?.unsubscribe();
      } catch (e) {
        console.debug('Error unsubscribing job channel on unmount', e);
      }
    };
  }, []);

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

  // Build a deduplicated list of ads for the main listing by taking the
  // first representative from each grouping. This prevents duplicate
  // creatives from showing multiple times on the main results grid.
  const dedupedAds = useMemo(() => {
    const out: Ad[] = [];
    groupedAll.forEach((groupAds) => {
      if (groupAds && groupAds.length) out.push(groupAds[0]);
    });
    return out;
  }, [groupedAll]);

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

  // Normalize a realtime payload to a plain record if possible.
  function getRowFromPayload(p: unknown): Record<string, unknown> | null {
    if (!p || typeof p !== 'object') return null;
    const obj = p as Record<string, unknown>;
    if ('record' in obj && obj.record && typeof obj.record === 'object')
      return obj.record as Record<string, unknown>;
    if ('new' in obj && obj.new && typeof obj.new === 'object')
      return obj.new as Record<string, unknown>;
    return obj;
  }

  const adIdToGroupMap: Record<string, Ad[]> = useMemo(() => {
    const out: Record<string, Ad[]> = {};
    groupedAll.forEach((groupAds) => {
      for (const ad of groupAds) out[ad.id] = groupAds;
    });
    return out;
  }, [groupedAll]);

  const ungroupedPages = useMemo(
    () => utils.chunk(dedupedAds, itemsPerPage),
    [dedupedAds, itemsPerPage]
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

  const totalAds = typeof initialTotalAds === 'number' ? initialTotalAds : dedupedAds.length;

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
        // try to obtain currently authenticated user id (if any) and include it
        let userId: string | null = null;
        try {
          const userRes = await supabase.auth.getUser();
          userId = userRes?.data?.user?.id ?? null;
        } catch (e) {
          console.debug('Could not get supabase user id for parse request', e);
        }

        // generate a job id so we can track import_status for this request
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

        // Prepare a realtime subscription to import_status for this job
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
                  const row = getRowFromPayload(payload);
                  if (!row) return;
                  // If a userId was provided, ensure the row belongs to that user
                  const maybeUserId = row['user_id'];
                  if (userId && maybeUserId && String(maybeUserId) !== String(userId)) return;
                  // update processing message and mark done on status
                  const message = row['message'];
                  if (typeof message === 'string') {
                    setProcessingMessage((prev) => prev || message);
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
                    // schedule clearing of the display after a short delay
                    scheduleClearDisplay(6000);
                    // unsubscribe when finished
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

        // set initial processing states
        console.debug('[AdArchive] starting parse, jobId=', jobId, 'userId=', userId);
        setProcessingMessage('Креативи підвантажуються...');
        // Do not open the modal automatically — show inline processing info instead.
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

        // request/response logging removed

        // persist job id locally so UI can read it later if needed
        // record parse start in logs
        // parse_start logging removed
        setImportJobId(jobId);

        // store channel reference if job-specific subscription was created above
        if (channel) jobChannelRef.current = channel;

        // Try to read any existing import_status row for this job so we show DB message immediately.
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
              setProcessingMessage((prev) => prev || existing.message);
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

        // safely inspect result object
        const resultObj =
          result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
        if (resultObj && resultObj['success'] === true) {
          // Do not set a static success message here — rely on `import_status` DB updates
          // The Make scenario should insert/update `import_status` rows; realtime
          // subscription and initial DB read will surface messages and final status.
        } else {
          // If the webhook returned an error, surface it in the inline status
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
  }, [productFilter, selectedTags, selectedCreativeType, numberToScrape]);

  const videoAds = useMemo(
    () => dedupedAds.filter((ad) => ad.display_format === 'VIDEO').length,
    [dedupedAds]
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
      try {
        // notify any UI consumers to focus/clear input
        window.dispatchEvent(new CustomEvent('productFilterCleared'));
      } catch (e) {}
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

  // Allow external callers to subscribe to a specific job id. This will attach a
  // realtime listener for that job and fetch the latest DB row immediately.
  const subscribeToJob = useCallback(async (jobId: string, userId?: string | null) => {
    if (!jobId) return;

    // cleanup previous job channel
    try {
      jobChannelRef.current?.unsubscribe();
    } catch (e) {
      console.debug('Error unsubscribing previous job channel', e);
    }

    // Read latest row for the job
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
          setProcessingMessage((prev) => prev || existing.message);
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

    // create per-job realtime listener
    try {
      const channel = supabase
        .channel(`import-status-sub-${jobId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'import_status', filter: `job_id=eq.${jobId}` },
          (payload: unknown) => {
            try {
              const row = getRowFromPayload(payload);
              if (!row) return;
              // If userId was provided, ensure row belongs to that user
              const maybeUserId = row['user_id'];
              if (userId && maybeUserId && String(maybeUserId) !== String(userId)) return;
              const message = row['message'];
              if (typeof message === 'string') {
                setProcessingMessage((prev) => prev || message);
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
