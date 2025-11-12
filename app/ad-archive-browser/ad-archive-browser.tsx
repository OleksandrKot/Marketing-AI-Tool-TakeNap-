'use client';

import Header from './components/Header';
import SearchControls from './components/SearchControls';
import ResultsGrid from './components/ResultsGrid';
import PaginationBar from './components/PaginationBar';
import { useEffect } from 'react';
import type { Ad, FilterOptions } from '@/lib/types';
import { useAdArchive, type UseAdArchiveReturn } from './useAdArchive';

interface AdArchiveBrowserProps {
  initialAds: Ad[];
  pages: string[];
}

export function AdArchiveBrowser({ initialAds, pages }: AdArchiveBrowserProps) {
  const state = useAdArchive(initialAds) as UseAdArchiveReturn;

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
  } = state;

  // Ensure filters are cleared on initial client mount. This forces a fresh fetch
  // and prevents stale or pre-applied filters from hiding rows.
  useEffect(() => {
    try {
      if (typeof state.handleFilterChange === 'function') {
        state.handleFilterChange({
          search: '',
          page: null,
          date: null,
          tags: null,
        } as FilterOptions);
      }
    } catch (e) {
      // swallow errors here; diagnostics are printed by getAds
      // eslint-disable-next-line no-console
      console.debug('Failed to clear filters on mount:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
