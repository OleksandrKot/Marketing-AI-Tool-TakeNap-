'use client';

import Header from './components/Header';
import SearchControls from './components/SearchControls';
import ResultsGrid from './components/ResultsGrid';
import PaginationBar from './components/PaginationBar';
import type { Ad } from '@/lib/types';
import useAdArchive, { type UseAdArchiveReturn } from './useAdArchive';

interface AdArchiveBrowserProps {
  initialAds: Ad[];
  pages: string[];
  initialFilters?: import('@/lib/types').FilterOptions | null;
  initialTotalAds?: number;
}

export function AdArchiveBrowser({
  initialAds,
  pages,
  initialFilters,
  initialTotalAds,
}: AdArchiveBrowserProps) {
  // Pass explicit cleared filters to avoid relying on a client-side effect
  // to reset filters after mount. This initializes hook state correctly
  // so the component renders with cleared filters immediately.
  const clearedFilters = { search: '', page: null, date: null, tags: null };
  const state = useAdArchive(
    initialAds,
    initialFilters ?? clearedFilters,
    initialTotalAds,
    5 * 60 * 1000 // poll every 5 minutes by default
  ) as UseAdArchiveReturn;

  const {
    filteredAdsByType,
    currentPageAds,
    adIdToGroupMap,
    isLoading,
    showAINewsModal,
    processingMessage,
    handleSearch,
    handlePageChange,
    viewMode,
    setViewMode,
    currentPage,
    totalPages,
    productFilter,
    handleProductFilterChange,
    handleFilterChange,
    availableTags,
    selectedTags,
    handleTagsChange,
    clearProductFilter,
    selectedCreativeType,
    setSelectedCreativeType,
    videoAds,
    visibleAdsCount,
    totalAds,
    currentPageAdsCount,
    numberToScrape,
    setNumberToScrape,
    importJobId,
    importStatus,
    importSavedCreatives,
    importTotalCreatives,
    autoClearProcessing,
    setAutoClearProcessing,
  } = state;

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl">
      <Header />

      <SearchControls
        productFilter={productFilter}
        onProductFilterChange={handleProductFilterChange}
        onSearch={handleSearch}
        selectedCreativeType={selectedCreativeType}
        setSelectedCreativeType={setSelectedCreativeType}
        handleFilterChange={handleFilterChange}
        availableTags={availableTags}
        selectedTags={selectedTags}
        handleTagsChange={handleTagsChange}
        pagesLength={pages.length}
        pages={pages}
        filteredAdsCount={filteredAdsByType.length}
        videoAds={videoAds}
        clearProductFilter={clearProductFilter}
        processingMessage={processingMessage}
        processingDone={state.processingDone}
        numberToScrape={numberToScrape}
        setNumberToScrape={setNumberToScrape}
        importJobId={importJobId}
        importStatus={importStatus}
        importSavedCreatives={importSavedCreatives}
        importTotalCreatives={importTotalCreatives}
        autoClearProcessing={autoClearProcessing}
        setAutoClearProcessing={setAutoClearProcessing}
        clearProcessingDisplay={state.clearProcessingDisplay}
        requestLogs={state.requestLogs}
        clearRequestLogs={state.clearRequestLogs}
      />

      <div className="flex items-center justify-between w-full gap-4 mb-8">
        <PaginationBar
          visibleAdsCount={visibleAdsCount}
          totalAds={totalAds}
          currentPageAdsCount={currentPageAdsCount}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedCreativeType={selectedCreativeType}
          productFilter={productFilter}
          selectedTags={selectedTags}
        />
      </div>

      <ResultsGrid
        isLoading={isLoading}
        showAINewsModal={showAINewsModal}
        processingMessage={processingMessage}
        viewMode={viewMode}
        currentPageAds={currentPageAds}
        adIdToGroupMap={adIdToGroupMap}
        filteredAdsByType={filteredAdsByType}
        selectedCreativeType={selectedCreativeType}
        onCloseModal={() => {
          state.setShowAINewsModal(false);
          if (typeof state.setProcessingDone === 'function') state.setProcessingDone(false);
        }}
        processingDone={state.processingDone}
      />
    </div>
  );
}

export default AdArchiveBrowser;
