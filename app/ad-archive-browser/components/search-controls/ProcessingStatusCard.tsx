'use client';

import { Button } from '@/components/ui/button';
import { LogsToggle } from './LogsToggle';

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
}: ProcessingStatusCardProps) {
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
          </>
        )}
      </div>

      <div className="flex items-center md:ml-4 space-x-3 mt-2 md:mt-0">
        <LogsToggle checked={showLogs} onChange={onToggleLogs} />
        <Button
          onClick={onClearProcessing}
          className="h-8 px-3 text-sm bg-slate-100 hover:bg-slate-200 text-slate-800"
        >
          Очистити
        </Button>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <>
      <p className="text-sm text-blue-900 font-medium">How it works:</p>
      <p className="text-sm text-blue-700 mt-1">
        1. Paste a <strong>Meta Ad Library link</strong> (we will detect the product automatically)
        <br />
        2. Choose <strong>creative type</strong> (All / Video / Static)
        <br />
        3. Click <strong>Search</strong> to start processing
      </p>
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
    case 'done':
      return 'bg-green-500';
    default:
      return 'bg-blue-500';
  }
}
