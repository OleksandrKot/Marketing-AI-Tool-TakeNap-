'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { LogsToggle } from './LogsToggle';
import * as RadixSwitch from '@radix-ui/react-switch';

type ProcessingStatusCardProps = {
  isActiveProcessing: boolean;
  processingMessage?: string;
  processingDone?: boolean;
  normalizedStatus: string | null;
  importSavedCreatives?: number | null;
  importTotalCreatives?: number | null;
  showLogs: boolean;
  onToggleLogs: (next: boolean) => void;
  onClearProcessing: () => void;
  autoClearProcessing?: boolean;
  setAutoClearProcessing?: (v: boolean) => void;
  importStatus?: string | null;
  importJobId?: string | null;
  pageName?: string | null;
};

export function ProcessingStatusCard({
  isActiveProcessing,
  processingMessage,
  processingDone,
  normalizedStatus,
  importSavedCreatives,
  importTotalCreatives,
  showLogs,
  onToggleLogs,
  onClearProcessing,
  autoClearProcessing = true,
  setAutoClearProcessing = () => {},
  importStatus = null,
  importJobId = null,
  pageName = null,
}: ProcessingStatusCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();
  const statusColorClass = getStatusColor(normalizedStatus);
  const statusDotClass = getStatusDotColor(normalizedStatus);

  return (
    <div className="mb-6 border rounded-xl p-4 flex flex-col md:flex-row md:items-start md:justify-between space-y-3 md:space-y-0 bg-blue-50 border-blue-200">
      <div className="flex-1">
        {!isActiveProcessing && !processingDone ? (
          <HowItWorks />
        ) : (
          <>
            <p className="text-sm text-blue-900 font-medium">Import status</p>
            <p className={`text-sm mt-1 ${statusColorClass} flex items-center gap-2`}>
              <span className={`inline-block w-2 h-2 rounded-full ${statusDotClass}`} />
              <span>{processingMessage || normalizedStatus || 'Processing started'}</span>
            </p>
            {importSavedCreatives !== null && (
              <p className="text-sm text-slate-700 mt-2">
                Saved creatives: <strong className="text-slate-900">{importSavedCreatives}</strong>
                {importTotalCreatives !== null ? <span> / {importTotalCreatives}</span> : null}
              </p>
            )}
            {/* Download CSV button: appears under import status and activates after successful save */}
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    if (!importJobId) {
                      showToast({ message: 'No import job available to export', type: 'error' });
                      return;
                    }
                    if (importStatus !== 'done' && importStatus !== 'success' && !processingDone) {
                      showToast({
                        message: 'Export is available only after import completes',
                        type: 'error',
                      });
                      return;
                    }

                    if (!importSavedCreatives || importSavedCreatives <= 0) {
                      showToast({ message: 'No creatives to export', type: 'error' });
                      return;
                    }

                    setIsExporting(true);
                    const params = new URLSearchParams();
                    // Include both names for compatibility: server will try job_id then import_job_id
                    params.set('job_id', String(importJobId));
                    params.set('import_job_id', String(importJobId));
                    // Prefer explicit pageName from props, otherwise fall back to URL query
                    const urlPageName =
                      typeof window !== 'undefined'
                        ? new URLSearchParams(window.location.search).get('page_name') || ''
                        : '';
                    const finalPageName = (pageName as string) || urlPageName || '';
                    if (finalPageName) params.set('page_name', finalPageName);

                    const resp = await fetch(`/api/ads/export-csv?${params.toString()}`);
                    if (!resp.ok) {
                      const json = await resp.json().catch(() => null);
                      const msg = json?.error || `Export failed (${resp.status})`;
                      showToast({ message: msg, type: 'error' });
                      setIsExporting(false);
                      return;
                    }

                    const blob = await resp.blob();
                    const cd = resp.headers.get('Content-Disposition') || '';
                    let filename = '';
                    const m = cd.match(/filename=\"?([^\";]+)\"?/);
                    if (m && m[1]) filename = m[1];
                    else {
                      const date = new Date().toISOString().slice(0, 10);
                      const safePage = finalPageName
                        ? finalPageName.replace(/[^a-z0-9_-]/gi, '_')
                        : String(importJobId).slice(0, 8);
                      filename = `creatives_export_${date}_${safePage}.csv`;
                    }

                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    showToast({ message: 'CSV download started', type: 'success' });
                  } catch (e) {
                    console.error('Export CSV error', e);
                    showToast({ message: 'Export failed. Please try again.', type: 'error' });
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={
                  isExporting ||
                  // allow export when we have either an importJobId or a pageName to query by
                  (!importJobId && !pageName) ||
                  // allow when importStatus indicates success or when processingDone is true
                  !(importStatus === 'done' || importStatus === 'success' || processingDone) ||
                  !(importSavedCreatives && importSavedCreatives > 0)
                }
              >
                {isExporting ? 'Preparing CSV...' : 'Download CSV'}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col items-start md:ml-4 space-y-3 mt-2 md:mt-0">
        <div>
          <LogsToggle checked={showLogs} onChange={onToggleLogs} />
        </div>

        <div className="flex items-center gap-3">
          <RadixSwitch.Root
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              autoClearProcessing ? 'bg-blue-600' : 'bg-slate-200'
            }`}
            checked={!!autoClearProcessing}
            onCheckedChange={(v) => setAutoClearProcessing(Boolean(v))}
            aria-label="Авто-очищення статусу"
          >
            <RadixSwitch.Thumb
              className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                autoClearProcessing ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </RadixSwitch.Root>
          <span className="text-sm text-slate-700">Авто-очищення</span>
        </div>

        <div>
          <Button
            onClick={onClearProcessing}
            className="h-8 px-3 text-sm bg-slate-100 hover:bg-slate-200 text-slate-800"
          >
            Очистити
          </Button>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <>
      <p className="text-sm text-blue-900 font-medium">How it works:</p>
      <div className="text-sm text-blue-700 mt-1">
        <ol className="list-decimal ml-5 space-y-2">
          <li>
            Paste a <span className="font-semibold">Meta Ad Library link</span>. We will detect the
            product automatically.
          </li>
          <li>
            Choose a <span className="font-semibold">creative type</span> —{' '}
            <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-medium">All</span> /{' '}
            <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-medium">Video</span> /{' '}
            <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-medium">Static</span>.
          </li>
          <li>
            Click the{' '}
            <span className="inline-block px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-medium">
              Search
            </span>{' '}
            button to start processing.
          </li>
        </ol>

        <p className="text-xs text-slate-600 mt-3">
          <span className="font-semibold">Note:</span> If this is the first time using a Meta Ad
          Library link and it contains X creatives, then on subsequent runs, to fetch only the new
          creatives enter the previous total (X) plus the number of new creatives you want to fetch.
        </p>
      </div>
    </>
  );
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case 'processing':
      return 'text-yellow-700';
    case 'error':
      return 'text-red-600';
    case 'done':
      return 'text-green-700';
    default:
      return 'text-blue-700';
  }
}

function getStatusDotColor(status: string | null): string {
  switch (status) {
    case 'processing':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    case 'success ':
      return 'bg-green-500';
    default:
      return 'bg-blue-500';
  }
}
