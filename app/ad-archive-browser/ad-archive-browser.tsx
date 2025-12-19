'use client';

import Header from './components/Header';
import { useEffect } from 'react';
import SearchControls from './components/search-controls';
import ResultsGrid from './components/ResultsGrid';
import PaginationBar from './components/PaginationBar';
import type { Ad } from '@/lib/core/types';
import useAdArchive, { type UseAdArchiveReturn } from './useAdArchive';

interface AdArchiveBrowserProps {
  initialAds: Ad[];
  pages: string[];
  initialFilters?: import('@/lib/core/types').FilterOptions | null;
  initialTotalAds?: number;
}

export function AdArchiveBrowser({
  initialAds,
  pages,
  initialFilters,
  initialTotalAds,
}: AdArchiveBrowserProps) {
  type SortMode = 'auto' | 'most_variations' | 'least_variations' | 'newest';
  const clearedFilters = { search: '', page: null, date: null, tags: null };
  const state = useAdArchive(
    initialAds,
    initialFilters ?? clearedFilters,
    initialTotalAds,
    60 * 1000 // poll every 30 seconds by default
  ) as UseAdArchiveReturn;

  const {
    filteredAdsByType,
    currentPageAds,
    adIdToGroupMap,
    adIdToRelatedCount,
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
    userSortMode,
    setUserSortMode,
  } = state;

  // Default sort on main archive to ascending variations (least -> most)
  useEffect(() => {
    try {
      if (userSortMode === 'auto' || !userSortMode) setUserSortMode('most_variations');
    } catch (e) {
      /* noop */
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No auto-advance on scroll. Use explicit Next button below.

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
        filteredAdsCount={totalAds}
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

      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-3">
          <label htmlFor="archive-sort" className="text-sm text-slate-600 mr-2">
            Sort:
          </label>
          <select
            id="archive-sort"
            value={userSortMode}
            onChange={(e) => setUserSortMode(e.target.value as SortMode)}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm"
          >
            <option value="auto">Auto (intelligent)</option>
            <option value="most_variations">Most variations</option>
            <option value="least_variations">Least variations</option>
            <option value="newest">Newest in database</option>
          </select>
        </div>
      </div>

      <ResultsGrid
        isLoading={isLoading}
        showAINewsModal={showAINewsModal}
        processingMessage={processingMessage}
        viewMode={viewMode}
        currentPageAds={currentPageAds}
        adIdToGroupMap={adIdToGroupMap}
        adIdToRelatedCount={adIdToRelatedCount}
        filteredAdsByType={filteredAdsByType}
        selectedCreativeType={selectedCreativeType}
        onCloseModal={() => {
          state.setShowAINewsModal(false);
          if (typeof state.setProcessingDone === 'function') state.setProcessingDone(false);
        }}
        processingDone={state.processingDone}
      />

      {/* Next page button shown at bottom when more pages are available */}
      {currentPage < (totalPages || 0) && !isLoading && (
        <div className="flex justify-center mt-8">
          <button
            type="button"
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700"
          >
            Next page
          </button>
        </div>
      )}
    </div>
  );
}

export default AdArchiveBrowser;
