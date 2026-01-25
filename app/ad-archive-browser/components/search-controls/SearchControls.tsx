'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { FilterOptions } from '@/lib/core/types';
import { StatsBar } from '@/components/stats/stats-bar';
import { CreativeTypeSelector } from '@/components/selectors/CreativeTypeSelector';
import { FilterBar } from '@/components/filters/filter-bar';
import { ProcessingStatusCard } from './ProcessingStatusCard';
import { RequestLogsPanel } from './RequestLogsPanel';
import { SearchButton } from './SearchButton';
import { useSignInGate } from './useSignInGate';

const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
  ssr: false,
  loading: () => null,
});

type RequestLog = {
  id?: string;
  time?: string;
  type?: string;
  text?: string;
  meta?: Record<string, unknown>;
};

type UploadResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  stderr?: string;
  jobId?: string;
  [key: string]: unknown;
};

type Props = {
  productFilter: string;
  onProductFilterChange: (value: string) => void;
  onSearch: () => void | Promise<void>;
  selectedCreativeType: 'all' | 'video' | 'image';
  setSelectedCreativeType: (value: 'all' | 'video' | 'image') => void;
  handleFilterChange: (filters: FilterOptions) => Promise<void>;
  availableTags: string[];
  selectedTags: string[];
  handleTagsChange: (tags: string[]) => Promise<void>;
  pagesLength: number;
  pages: string[];
  filteredAdsCount: number;
  videoAds: number;
  clearProductFilter: () => void | Promise<void>;
  numberToScrape?: number;
  setNumberToScrape?: (value: number) => void;
  autoClearProcessing?: boolean;
  setAutoClearProcessing?: (value: boolean) => void;
  clearProcessingDisplay?: () => void;
  processingMessage?: string;
  processingDone?: boolean;
  importJobId?: string | null;
  importStatus?: string | null;
  importSavedCreatives?: number | null;
  importTotalCreatives?: number | null;
  requestLogs?: RequestLog[];
  clearRequestLogs?: () => void;
  businesses?: { id: string; name: string; slug: string }[];
  selectedBusiness?: string;
};

const PERSISTENCE_KEY = 'ad_archive_show_logs';
const JOB_ID_KEY = 'ad_archive_import_job_id';
const UPLOAD_PROGRESS_KEY = 'ad_archive_import_progress';

function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      onProgress(pct);
    };

    xhr.onload = () => {
      let json: UploadResponse | null = null;
      try {
        json = JSON.parse(xhr.responseText || '{}');
      } catch {
        // ignore
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(json ?? {});
      const msg = json?.error || json?.message || json?.stderr || `Upload failed (${xhr.status})`;
      return reject(new Error(msg));
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

export function SearchControls({
  productFilter,
  onProductFilterChange,
  onSearch,
  selectedCreativeType,
  setSelectedCreativeType,
  handleFilterChange,
  availableTags,
  selectedTags,
  handleTagsChange,
  pagesLength,
  pages,
  filteredAdsCount,
  videoAds,
  numberToScrape = 10,
  setNumberToScrape = () => {},
  clearProductFilter = () => {},
  clearProcessingDisplay = () => {},
  processingMessage,
  processingDone = false,
  importStatus = null,
  importJobId = null,
  importSavedCreatives = null,
  importTotalCreatives = null,
  autoClearProcessing = true,
  setAutoClearProcessing = () => {},
  requestLogs = [],
  clearRequestLogs = () => {},
  businesses = [],
  selectedBusiness,
}: Props) {
  const router = useRouter();
  const [showLogs, setShowLogs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number>(0);

  const [uploadProgress, setUploadProgress] = useState<{
    phase: 'uploading' | 'counting' | 'processing' | 'done';
    processed: number;
    total: number;
    toProcess: number;
    ok: number;
    skipped: number;
    failed: number;
    countDuration?: number;
    processDuration?: number;
    speedAdsPerSec?: number;
    etaSec?: number | null;
  } | null>(null);

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const { requireLoginAndRun, showLogin, closeLogin, showSignInTip } = useSignInGate();

  const refreshedOnceRef = useRef(false);
  const processingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSISTENCE_KEY);
      if (raw !== null) setShowLogs(raw === '1' || raw === 'true');
    } catch (error) {
      console.debug('Unable to read logs preference', error);
    }
  }, []);

  // Restore import job state on page load
  useEffect(() => {
    try {
      const savedJobId = localStorage.getItem(JOB_ID_KEY);
      const savedProgress = localStorage.getItem(UPLOAD_PROGRESS_KEY);

      if (savedJobId && savedProgress) {
        const progress = JSON.parse(savedProgress);
        if (progress.phase !== 'done') {
          console.log('[SearchControls] Restoring import job:', savedJobId);
          setCurrentJobId(savedJobId);
          setUploadProgress(progress);
          setUploading(true);
          setUploadMessage(`Resuming import (job: ${savedJobId.slice(0, 8)}...)`);
          resumeImportPolling(savedJobId);
        } else {
          try {
            localStorage.removeItem(JOB_ID_KEY);
            localStorage.removeItem(UPLOAD_PROGRESS_KEY);
          } catch (e) {
            console.debug('Unable to clear progress', e);
          }
        }
      }
    } catch (error) {
      console.debug('Unable to restore import state', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist logs preference
  useEffect(() => {
    try {
      localStorage.setItem(PERSISTENCE_KEY, showLogs ? '1' : '0');
    } catch (error) {
      console.debug('Unable to persist logs preference', error);
    }
  }, [showLogs]);

  const isActiveProcessing =
    (!!importStatus && importStatus !== 'done' && importStatus !== 'error') ||
    (!!processingMessage && !processingDone) ||
    importStatus === 'processing';

  const normalizedStatus = useMemo(() => {
    if (importStatus) return importStatus;
    if (processingDone) return 'done';
    if (processingMessage) return 'processing';
    return null;
  }, [importStatus, processingDone, processingMessage]);

  const searchLabel =
    selectedCreativeType === 'all'
      ? 'Search All Types'
      : selectedCreativeType === 'video'
      ? 'Search Videos Only'
      : 'Search Static Only';

  const handleSearch = () => {
    try {
      const val = (productFilter || '').trim();
      if (val && !val.includes('facebook.com/ads/library')) {
        const parts = val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const looksLikeFunnel = parts.every((p) => p.includes('/') || p.includes('.'));
        if (looksLikeFunnel) {
          const q = parts.map((p) => encodeURIComponent(p)).join(',');
          router.push(`/advance-filter?funnels=${q}`);
          return;
        }
      }
    } catch {
      /* ignore */
    }

    requireLoginAndRun(onSearch);
  };

  const resumeImportPolling = (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const debugParam = showLogs ? '&debug=1' : '';
        const response = await fetch(
          `/api/import-ads-json?jobId=${encodeURIComponent(jobId)}${debugParam}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            clearInterval(pollInterval);
            setUploading(false);
            setCurrentJobId(null);
            setUploadMessage('Import finished or stopped.');
            setUploadProgress(null);
            try {
              localStorage.removeItem(JOB_ID_KEY);
              localStorage.removeItem(UPLOAD_PROGRESS_KEY);
            } catch {
              /* noop */
            }
            // refresh results once
            if (!refreshedOnceRef.current) {
              refreshedOnceRef.current = true;
              router.refresh();
            }
          } else {
            setUploadError(`Failed to poll status (${response.status} ${response.statusText})`);
          }
          return;
        }

        const payload = await response.json();

        if (typeof payload?.lastUpdateAt === 'number') {
          setLastUpdateAt(payload.lastUpdateAt);
        }

        // Debug tails
        if (Array.isArray(payload?.logTail) && payload.logTail.length) {
          for (const line of payload.logTail) console.debug('[import-debug]', line);
        }
        if (Array.isArray(payload?.stdoutTail) && payload.stdoutTail.length) {
          for (const line of payload.stdoutTail) console.debug('[import-stdout]', line);
        }
        if (Array.isArray(payload?.stderrTail) && payload.stderrTail.length) {
          for (const line of payload.stderrTail) console.error('[import-stderr]', line);
        }

        // Final status
        if (
          payload?.status === 'stopped' ||
          payload?.status === 'failed' ||
          payload?.status === 'done'
        ) {
          const status = payload.status;
          const processed = payload?.doneEvent?.processed ?? payload?.lastProgress?.processed ?? 0;
          const total =
            payload?.doneEvent?.total ??
            payload?.lastProgress?.total ??
            payload?.countEvent?.total ??
            0;
          const ok = payload?.doneEvent?.ok ?? payload?.lastProgress?.ok ?? 0;
          const skipped = payload?.doneEvent?.skipped ?? payload?.lastProgress?.skipped ?? 0;
          const failed = payload?.doneEvent?.failed ?? payload?.lastProgress?.failed ?? 0;
          const toProcess = payload?.countEvent?.to_process ?? total;
          const countDuration = payload?.countEvent?.duration_ms ?? undefined;
          const processDuration = payload?.doneEvent?.duration_ms ?? undefined;

          setUploadProgress({
            phase: 'done',
            processed,
            total,
            toProcess,
            ok,
            skipped,
            failed,
            countDuration,
            processDuration,
          });
          setUploadMessage(
            `Import ${status}: processed ${processed}/${total} (✓${ok} ⊘${skipped} ✗${failed})`
          );
          setUploading(false);
          setCurrentJobId(null);
          try {
            localStorage.removeItem(JOB_ID_KEY);
            localStorage.removeItem(UPLOAD_PROGRESS_KEY);
          } catch {
            /* noop */
          }
          clearInterval(pollInterval);

          // refresh results once
          if (!refreshedOnceRef.current) {
            refreshedOnceRef.current = true;
            router.refresh();
          }
          return;
        }

        // Count progress
        if (payload?.lastCountProgress) {
          const { checked, total, will_process } = payload.lastCountProgress;
          setUploadMessage(
            `Counting: checked ${checked}/${total} ads, will process ${will_process}`
          );
          setUploadProgress((prev) => {
            const base = prev ?? {
              phase: 'counting' as const,
              processed: 0,
              total: 0,
              toProcess: 0,
              ok: 0,
              skipped: 0,
              failed: 0,
            };
            const updated = {
              ...base,
              phase: 'counting' as const,
              processed: checked,
              total,
              toProcess: will_process,
            };
            try {
              localStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(updated));
            } catch (e) {
              console.debug('Unable to save progress', e);
            }
            return updated;
          });
        }

        // Count complete => processing phase starts
        if (payload?.countEvent) {
          const { total, to_process, duration_ms } = payload.countEvent;
          setUploadMessage(
            `Count complete: ${to_process} ads to process (${total - to_process} already in DB)`
          );
          if (!processingStartedAtRef.current) processingStartedAtRef.current = Date.now();

          setUploadProgress((prev) => {
            const base = prev ?? {
              phase: 'processing' as const,
              processed: 0,
              total: 0,
              toProcess: 0,
              ok: 0,
              skipped: 0,
              failed: 0,
            };
            const updated = {
              ...base,
              phase: 'processing' as const,
              total,
              toProcess: to_process,
              countDuration: duration_ms,
            };
            try {
              localStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(updated));
            } catch (e) {
              console.debug('Unable to save progress', e);
            }
            return updated;
          });
        }

        // Processing progress
        if (payload?.lastProgress) {
          const { ok, skipped, failed, processed, total } = payload.lastProgress;

          const startedAt = processingStartedAtRef.current;
          const elapsedSec = startedAt ? (Date.now() - startedAt) / 1000 : 0;
          const speedAdsPerSec = elapsedSec > 0 ? processed / elapsedSec : undefined;

          setUploadProgress((prev) => {
            const base = prev ?? {
              phase: 'processing' as const,
              processed: 0,
              total,
              toProcess: total,
              ok: 0,
              skipped: 0,
              failed: 0,
            };
            const toProcess = base.toProcess || total;
            const remaining = Math.max(0, toProcess - processed);
            const etaSec = speedAdsPerSec && speedAdsPerSec > 0 ? remaining / speedAdsPerSec : null;

            const updated = {
              ...base,
              phase: 'processing' as const,
              processed,
              total,
              ok,
              skipped,
              failed,
              speedAdsPerSec,
              etaSec,
            };
            try {
              localStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(updated));
            } catch (e) {
              console.debug('Unable to save progress', e);
            }
            return updated;
          });

          setUploadMessage(`Processing: ${processed}/${total} ads (✓${ok} ⊘${skipped} ✗${failed})`);
        }

        // Done event (legacy)
        if (payload?.doneEvent) {
          const { status, ok, skipped, failed, processed, total, duration_ms } = payload.doneEvent;
          const countDur = payload?.countEvent?.duration_ms || 0;
          setUploadProgress({
            phase: 'done',
            processed,
            total,
            toProcess: processed,
            ok,
            skipped,
            failed,
            countDuration: countDur,
            processDuration: duration_ms,
          });
          setUploadMessage(
            `Import ${status}: processed ${processed} ads (✓ ${ok}, ⊘ ${skipped}, ✗ ${failed}) in ${duration_ms}ms`
          );
          setUploading(false);
          setCurrentJobId(null);

          try {
            localStorage.removeItem(JOB_ID_KEY);
            localStorage.removeItem(UPLOAD_PROGRESS_KEY);
          } catch (e) {
            console.debug('Unable to clear progress', e);
          }

          clearInterval(pollInterval);

          if (!refreshedOnceRef.current) {
            refreshedOnceRef.current = true;
            router.refresh();
          }
        }
      } catch (error) {
        console.debug('Error polling status:', error);
      }
    }, 2000);
  };

  const handleImportJson = async (file: File) => {
    setUploadError(null);
    setUploadPct(0);
    setUploadProgress({
      phase: 'uploading',
      processed: 0,
      total: 0,
      toProcess: 0,
      ok: 0,
      skipped: 0,
      failed: 0,
    });
    setUploadMessage(`Uploading ${file.name}... 0%`);
    setUploading(true);
    refreshedOnceRef.current = false;
    processingStartedAtRef.current = null;

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (showLogs) formData.append('debug', '1');

      const payload = await uploadWithProgress('/api/import-ads-json', formData, (pct) => {
        setUploadPct(pct);
        setUploadMessage(`Uploading ${file.name}... ${pct}%`);
      });

      if (payload?.success === false) {
        const err =
          payload?.error || payload?.message || payload?.stderr || 'Failed to start import';
        throw new Error(err);
      }

      // Initialize progress display for counting
      if (payload?.jobId) {
        setCurrentJobId(payload.jobId);
        try {
          localStorage.setItem(JOB_ID_KEY, payload.jobId);
          const initialProgress = {
            phase: 'counting' as const,
            processed: 0,
            total: 0,
            toProcess: 0,
            ok: 0,
            skipped: 0,
            failed: 0,
          };
          setUploadProgress(initialProgress);
          localStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(initialProgress));
        } catch (e) {
          console.debug('Unable to save job ID', e);
        }

        setUploadMessage(`Import started (job: ${payload.jobId.slice(0, 8)}...) - counting ads...`);
        resumeImportPolling(payload.jobId);
        return;
      }

      // Fallback: if backend returns synchronous status (rare)
      setUploadMessage('Import started, but no jobId returned.');
      setUploading(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setUploadError(message);
      setUploading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleImportJson(file);
    event.target.value = '';
  };

  const triggerFilePicker = () => {
    requireLoginAndRun(() => uploadInputRef.current?.click());
  };

  const handleStopImport = async () => {
    if (!currentJobId) return;
    try {
      const formData = new FormData();
      formData.append('action', 'stop');
      formData.append('jobId', currentJobId);
      await fetch('/api/import-ads-json', { method: 'POST', body: formData });
      setUploadMessage('Stop signal sent — processing remaining ads...');
    } catch {
      setUploadError('Failed to send stop signal');
    }
  };

  const renderLastUpdate = () =>
    lastUpdateAt ? (
      <div className="text-xs text-slate-500 mt-1">
        Last update: {Math.max(0, Math.round((Date.now() - lastUpdateAt) / 1000))}s ago
      </div>
    ) : null;

  return (
    <>
      {productFilter && <div className="mb-4" aria-hidden />}

      {/* Business Selector */}
      {businesses && businesses.length > 0 && (
        <div className="mb-6">
          <label
            htmlFor="business-selector"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Filter by Business
          </label>
          <select
            id="business-selector"
            value={selectedBusiness || ''}
            onChange={(e) => {
              const value = e.target.value;
              const params = new URLSearchParams(window.location.search);
              if (value) {
                params.set('business', value);
              } else {
                params.delete('business');
              }
              router.push(`/?${params.toString()}`);
            }}
            className="w-full px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Businesses</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatsBar
          totalAds={filteredAdsCount}
          videoAds={videoAds}
          uniquePages={pagesLength}
          columnIndex={0}
          value={productFilter}
          onChange={onProductFilterChange}
          onEnterPress={handleSearch}
          numberToScrape={numberToScrape}
          setNumberToScrape={setNumberToScrape}
        />
        <CreativeTypeSelector
          selectedType={selectedCreativeType}
          onTypeChange={setSelectedCreativeType}
        />
      </div>

      {showLogs && requestLogs.length > 0 && (
        <RequestLogsPanel logs={requestLogs} onClear={clearRequestLogs} />
      )}

      <ProcessingStatusCard
        isActiveProcessing={isActiveProcessing}
        processingMessage={processingMessage}
        processingDone={processingDone}
        normalizedStatus={normalizedStatus}
        importSavedCreatives={importSavedCreatives}
        importTotalCreatives={importTotalCreatives}
        importStatus={importStatus}
        importJobId={importJobId}
        pageName={pages && pages.length > 0 ? pages[0] : ''}
        showLogs={showLogs}
        onToggleLogs={setShowLogs}
        onClearProcessing={clearProcessingDisplay}
        autoClearProcessing={typeof autoClearProcessing === 'boolean' ? autoClearProcessing : true}
        setAutoClearProcessing={(v: boolean) => {
          try {
            if (typeof v === 'boolean') setAutoClearProcessing?.(v);
          } catch (e) {
            console.debug('setAutoClearProcessing error', e);
          }
        }}
      />

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-start">
        <div className="flex flex-col gap-3">
          <SearchButton label={searchLabel} onClick={handleSearch} showSignInTip={showSignInTip} />

          <input
            ref={uploadInputRef}
            type="file"
            multiple={true}
            accept="application/json"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={triggerFilePicker}
            disabled={uploading}
            className="w-full px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            title="Upload a JSON file with ads data to import into the database"
          >
            {uploading ? '⏳ Importing ads…' : '📤 Upload JSON to import'}
          </button>

          {currentJobId && (
            <button
              type="button"
              onClick={handleStopImport}
              className="w-full px-4 py-2 rounded-md border border-red-300 bg-red-50 text-red-700 shadow-sm hover:bg-red-100 text-sm"
              title="Stop the import process gracefully"
            >
              ⛔ Stop import
            </button>
          )}

          {!uploading && !uploadProgress && (
            <div className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded p-2">
              <div className="font-medium text-blue-700 mb-1">📘 How to import:</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click &quot;Upload JSON to import&quot;</li>
                <li>Select your ads JSON file</li>
                <li>Wait for counting phase to complete</li>
                <li>Watch processing progress (✓ success, ⊘ skipped, ✗ failed)</li>
                <li>Check console logs for details</li>
              </ol>
              <div className="mt-2 text-blue-600">
                💡 <b>Skipped</b> = already in DB | <b>Failed</b> = check console for errors
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className="text-sm bg-slate-100 p-3 rounded-md space-y-2 border border-slate-300">
              {uploadProgress.phase === 'uploading' && (
                <>
                  <div className="font-medium text-blue-700 flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Uploading JSON
                  </div>
                  <div className="text-xs text-slate-600">{uploadPct}%</div>
                  <div className="w-full bg-slate-300 rounded h-2 mt-2">
                    <div
                      className="bg-blue-500 h-2 rounded transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, uploadPct))}%` }}
                    />
                  </div>
                </>
              )}

              {uploadProgress.phase === 'counting' && (
                <>
                  <div className="font-medium text-blue-700 flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Phase 1/2: Counting Ads
                  </div>
                  <div className="text-xs text-slate-600">
                    Checked: <b>{uploadProgress.processed}</b> / {uploadProgress.total} ads
                  </div>
                  <div className="text-xs text-green-600">
                    📥 Will process: <b>{uploadProgress.toProcess}</b> new ads
                  </div>
                  <div className="text-xs text-slate-500">
                    ⏭ Already in DB: {uploadProgress.total - uploadProgress.toProcess}
                  </div>
                  {uploadProgress.countDuration && (
                    <div className="text-xs text-slate-500">
                      ⏱ Duration: {Math.round(uploadProgress.countDuration / 1000)}s
                    </div>
                  )}
                  <div className="w-full bg-slate-300 rounded h-2 mt-2">
                    <div
                      className="bg-blue-500 h-2 rounded transition-all"
                      style={{
                        width: uploadProgress.total
                          ? `${Math.round(
                              (uploadProgress.processed / uploadProgress.total) * 100
                            )}%`
                          : '0%',
                      }}
                    />
                  </div>
                  {renderLastUpdate()}
                </>
              )}

              {uploadProgress.phase === 'processing' && (
                <>
                  <div className="font-medium text-blue-700 flex items-center gap-2">
                    <span className="animate-spin">⚙️</span>
                    Phase 2/2: Processing Ads
                  </div>
                  <div className="text-xs text-slate-600">
                    Progress: <b>{uploadProgress.processed}</b> / {uploadProgress.toProcess}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-green-600 font-medium">✓ Success: {uploadProgress.ok}</div>
                    <div className="text-orange-600 font-medium">
                      ⊘ Skipped: {uploadProgress.skipped}
                    </div>
                    <div className="text-red-600 font-medium">
                      ✗ Failed: {uploadProgress.failed}
                    </div>
                  </div>

                  {typeof uploadProgress.speedAdsPerSec === 'number' &&
                    uploadProgress.speedAdsPerSec > 0 && (
                      <div className="text-xs text-slate-500">
                        ⚡ {uploadProgress.speedAdsPerSec.toFixed(1)} ads/sec
                        {typeof uploadProgress.etaSec === 'number'
                          ? ` · ETA ~${Math.round(uploadProgress.etaSec)}s`
                          : ''}
                      </div>
                    )}

                  {uploadProgress.toProcess > 0 && (
                    <>
                      <div className="w-full bg-slate-300 rounded h-2 mt-2">
                        <div
                          className="bg-green-500 h-2 rounded transition-all"
                          style={{
                            width: `${Math.round(
                              (uploadProgress.processed / Math.max(1, uploadProgress.toProcess)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 text-center">
                        {Math.round(
                          (uploadProgress.processed / Math.max(1, uploadProgress.toProcess)) * 100
                        )}
                        % complete
                      </div>
                    </>
                  )}

                  <div className="text-xs text-slate-500 bg-white rounded p-2 mt-2">
                    💡 Check browser console (F12) for detailed logs
                  </div>
                  {renderLastUpdate()}
                </>
              )}

              {uploadProgress.phase === 'done' && (
                <>
                  <div className="font-medium text-green-700 flex items-center gap-2">
                    ✅ Import Complete!
                  </div>
                  <div className="text-xs text-slate-600">
                    Total processed: <b>{uploadProgress.processed}</b> / {uploadProgress.total}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-green-600 font-medium">✓ {uploadProgress.ok} success</div>
                    <div className="text-orange-600 font-medium">
                      ⊘ {uploadProgress.skipped} skipped
                    </div>
                    <div className="text-red-600 font-medium">✗ {uploadProgress.failed} failed</div>
                  </div>
                  {uploadProgress.countDuration && (
                    <div className="text-xs text-slate-500">
                      ⏱ Count phase: {Math.round(uploadProgress.countDuration / 1000)}s
                    </div>
                  )}
                  {uploadProgress.processDuration && (
                    <div className="text-xs text-slate-500">
                      ⏱ Process phase: {Math.round(uploadProgress.processDuration / 1000)}s
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => router.refresh()}
                    className="w-full mt-2 px-4 py-2 rounded-md border border-blue-300 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 text-sm"
                  >
                    🔄 Refresh results
                  </button>
                </>
              )}
            </div>
          )}

          {(uploadMessage || uploadError) && (
            <div className="text-sm">
              {uploadMessage && <p className="text-green-700">{uploadMessage}</p>}
              {uploadError && <p className="text-red-600">{uploadError}</p>}
            </div>
          )}
        </div>

        <div className="md:col-span-2 flex justify-start w-full">
          <FilterBar
            onFilterChange={handleFilterChange}
            pages={pages}
            className="w-full"
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagsChange={handleTagsChange}
            onFiltersCleared={clearProductFilter}
          />
        </div>
      </div>

      {showLogin ? <LoginModal onClose={closeLogin} /> : null}
    </>
  );
}
