"use client"

import { AdCard } from "@/components/ad-card"
import { FilterBar } from "@/components/filter-bar"
import { ViewToggle } from "@/components/view-toggle"
import { StatsBar } from "@/components/stats-bar"
import { ProfileDropdown } from "@/app/login-auth/components/profile-dropdown"
import { PageNavigation } from "@/components/page-navigation"
import { AINewsModal } from "@/components/modals/ai-news-modal"
import { CreativeTypeSelector } from "@/components/creative-type-selector"
import { Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import Header from "./components/Header"
import SearchControls from "./components/SearchControls"
import ResultsGrid from "./components/ResultsGrid"
import PaginationBar from "./components/PaginationBar"
import { Button } from "@/components/ui/button"
import { ProductFilterIndicator } from "@/components/product-filter-indicator"
import type { Ad, FilterOptions, ViewMode } from "@/lib/types"
import { useAdArchive } from "./useAdArchive"

interface AdArchiveBrowserProps {
  initialAds: Ad[]
  pages: string[]
}

export function AdArchiveBrowser({ initialAds, pages }: AdArchiveBrowserProps) {
  const state = useAdArchive(initialAds, pages)

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
    setProductFilter,
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
  } = state as any

  return (
    <div className="min-h-screen bg-slate-50">
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
          onCloseModal={() => state.setShowAINewsModal(false)}
        />
      </div>
    </div>
  )
}

export default AdArchiveBrowser
