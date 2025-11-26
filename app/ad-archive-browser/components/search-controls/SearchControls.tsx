'use client';

import { useEffect, useState, useMemo } from 'react';
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
};

const PERSISTENCE_KEY = 'ad_archive_show_logs';

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
  importSavedCreatives = null,
  importTotalCreatives = null,
  requestLogs = [],
  clearRequestLogs = () => {},
}: Props) {
  const [showLogs, setShowLogs] = useState(false);
  const { requireLoginAndRun, showLogin, closeLogin, showSignInTip } = useSignInGate();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSISTENCE_KEY);
      if (raw !== null) setShowLogs(raw === '1' || raw === 'true');
    } catch (error) {
      console.debug('Unable to read logs preference', error);
    }
  }, []);

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

  const handleSearch = () => requireLoginAndRun(onSearch);

  return (
    <>
      {productFilter && <div className="mb-4" aria-hidden />}

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
        showLogs={showLogs}
        onToggleLogs={setShowLogs}
        onClearProcessing={clearProcessingDisplay}
        autoClearProcessing={typeof autoClearProcessing === 'boolean' ? autoClearProcessing : true}
        setAutoClearProcessing={(v: boolean) => {
          try {
            if (typeof v === 'boolean') {
              setAutoClearProcessing?.(v);
            }
          } catch (e) {
            console.debug('setAutoClearProcessing error', e);
          }
        }}
      />

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-center">
        <SearchButton label={searchLabel} onClick={handleSearch} showSignInTip={showSignInTip} />
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
