'use client';
/* eslint-disable react/prop-types */

import { StatsBar } from '@/components/stats-bar';
import { CreativeTypeSelector } from '@/components/creative-type-selector';
import { Button } from '@/components/ui/button';
// logging UI removed
import { FilterBar } from '@/components/filter-bar';
import { Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import type { FilterOptions } from '@/lib/types';

type Props = {
  productFilter: string;
  onProductFilterChange: (v: string) => void;
  onSearch: () => void;
  selectedCreativeType: 'all' | 'video' | 'image';
  setSelectedCreativeType: (v: 'all' | 'video' | 'image') => void;
  handleFilterChange: (filters: FilterOptions) => Promise<void>;
  availableTags: string[];
  selectedTags: string[];
  handleTagsChange: (tags: string[]) => Promise<void>;
  pagesLength: number;
  pages: string[];
  filteredAdsCount: number;
  videoAds: number;
  clearProductFilter: () => Promise<void> | void;
  onProductFilterChangeImmediate?: (v: string) => void;
  numberToScrape?: number;
  setNumberToScrape?: (n: number) => void;
  autoClearProcessing?: boolean;
  setAutoClearProcessing?: (b: boolean) => void;
  clearProcessingDisplay?: () => void;
  processingMessage?: string;
  processingDone?: boolean;
  importJobId?: string | null;
  importStatus?: string | null;
  importSavedCreatives?: number | null;
  importTotalCreatives?: number | null;
  requestLogs?: Array<{
    id?: string;
    time?: string;
    type?: string;
    text?: string;
    meta?: Record<string, unknown>;
  }>;
  clearRequestLogs?: () => void;
};

export default function SearchControls({
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
  clearProcessingDisplay = () => {},
  processingMessage,
  processingDone = false,
  importStatus = null,
  importSavedCreatives = null,
  importTotalCreatives = null,
  requestLogs = [],
  clearRequestLogs = () => {},
}: Props) {
  const [showLogs, setShowLogs] = useState<boolean>(false);
  // persist user preference for logs visibility
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ad_archive_show_logs');
      if (raw !== null) setShowLogs(raw === '1' || raw === 'true');
    } catch (e) {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('ad_archive_show_logs', showLogs ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }, [showLogs]);
  const isActiveProcessing =
    (!!importStatus && importStatus !== 'done' && importStatus !== 'error') ||
    (!!processingMessage && !processingDone) ||
    importStatus === 'processing';

  // Determine a normalized status for coloring: prefer DB `importStatus`, fall back
  // to local processing state when DB status is not available.
  let normalizedStatus: string | null = importStatus ?? null;
  if (!normalizedStatus) {
    if (processingDone) normalizedStatus = 'done';
    else if (processingMessage) normalizedStatus = 'processing';
  }

  const statusColorClass =
    normalizedStatus === 'processing'
      ? 'text-yellow-700'
      : normalizedStatus === 'error'
      ? 'text-red-600'
      : normalizedStatus === 'done'
      ? 'text-green-700'
      : 'text-blue-700';

  return (
    <>
      {productFilter && (
        <div className="mb-4">
          <div className="inline-block">
            <span />
          </div>
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
          onEnterPress={onSearch}
          numberToScrape={numberToScrape}
          setNumberToScrape={setNumberToScrape}
        />
        <CreativeTypeSelector
          selectedType={selectedCreativeType}
          onTypeChange={setSelectedCreativeType}
        />
      </div>

      {/* Request logs area (user-controlled) */}
      {showLogs && requestLogs && requestLogs.length > 0 && (
        <div className="mb-6 border rounded-xl p-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Журнал подій</p>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  try {
                    clearRequestLogs?.();
                  } catch (e) {
                    console.debug('clearRequestLogs failed', e);
                  }
                }}
                className="h-7 px-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800"
              >
                Очистити журнали
              </Button>
            </div>
          </div>
          <div className="max-h-48 overflow-auto text-sm text-slate-700">
            {requestLogs.map((r) => (
              <div key={r.id || r.time} className="mb-2 p-2 bg-slate-50 rounded">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-slate-500">
                    {r.time ? new Date(r.time).toLocaleString() : ''}
                  </div>
                  <div className="text-xs font-medium text-slate-600">{r.type || ''}</div>
                </div>
                <div className="mt-1 text-slate-800">{r.text}</div>
                {r.meta && (
                  <div className="mt-1 text-xs text-slate-500">{JSON.stringify(r.meta)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info / Processing box: shows 'How it works' by default, but when a job is active
          or a processing message exists, renders live status and progress. */}
      <div
        className={`mb-6 border rounded-xl p-4 flex items-start justify-between space-x-3 ${
          isActiveProcessing ? 'bg-blue-50 border-blue-200' : 'bg-blue-50 border-blue-200'
        }`}
      >
        <div className="flex-1">
          {!isActiveProcessing && !processingDone ? (
            <>
              <p className="text-sm text-blue-900 font-medium">How it works:</p>
              <p className="text-sm text-blue-700 mt-1">
                1. Paste a <strong>Meta Ad Library link</strong> (we will detect the product
                automatically)
                <br />
                2. Choose <strong>creative type</strong> (All / Video / Static)
                <br />
                3. Click <strong>Search</strong> to start processing
              </p>
            </>
          ) : (
            <>
              {/* Logs are rendered above and controlled by the user toggle */}

              <p className="text-sm text-blue-900 font-medium">Import status</p>
              <p className={`text-sm mt-1 ${statusColorClass} flex items-center gap-2`}>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    normalizedStatus === 'processing'
                      ? 'bg-yellow-500'
                      : normalizedStatus === 'error'
                      ? 'bg-red-500'
                      : normalizedStatus === 'done'
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                  }`}
                />
                <span>
                  {processingMessage || (importStatus ? importStatus : 'Processing started')}
                </span>
              </p>

              {importSavedCreatives !== null && (
                <p className="text-sm text-slate-700 mt-2">
                  Saved creatives:{' '}
                  <strong className="text-slate-900">{importSavedCreatives}</strong>
                  {importTotalCreatives !== null ? <span> / {importTotalCreatives}</span> : null}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center ml-4 space-x-3">
          <div className="flex items-center gap-3">
            <RadixSwitch.Root
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                showLogs ? 'bg-blue-600' : 'bg-slate-200'
              }`}
              checked={!!showLogs}
              onCheckedChange={(v) => setShowLogs?.(Boolean(v))}
              aria-label="Показувати журнали"
            >
              <RadixSwitch.Thumb
                className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                  showLogs ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </RadixSwitch.Root>
            <span className="text-sm text-slate-700">Показувати журнали подій</span>
          </div>

          <div>
            <Button
              onClick={() => clearProcessingDisplay?.()}
              className="h-8 px-3 text-sm bg-slate-100 hover:bg-slate-200 text-slate-800"
            >
              Очистити
            </Button>
          </div>
        </div>
      </div>
      {/* Request logs area (visible when toggle enabled) */}
      {/* request logs UI removed */}

      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="flex justify-center">
          <Button
            onClick={onSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25 h-9 w-full flex items-center justify-center"
          >
            <Search className="h-4 w-4 mr-2" />
            {selectedCreativeType === 'all'
              ? 'Search All Types'
              : selectedCreativeType === 'video'
              ? 'Search Videos Only'
              : 'Search Static Only'}
          </Button>
        </div>

        <div className="md:col-span-2 flex justify-start w-full">
          <FilterBar
            onFilterChange={handleFilterChange}
            pages={pages}
            className="w-full"
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagsChange={handleTagsChange}
          />
        </div>
      </div>
    </>
  );
}
