"use client"

import { useState } from "react"
import type { Ad, FilterOptions, ViewMode } from "@/lib/types"
import { AdCard } from "@/components/ad-card"
import { FilterBar } from "@/components/filter-bar"
import { ViewToggle } from "@/components/view-toggle"
import { StatsBar } from "@/components/stats-bar"
import { ProfileDropdown } from "@/components/profile-dropdown"
import { PageNavigation } from "@/components/page-navigation"
import { AINewsModal } from "@/components/ai-news-modal"
import { CreativeTypeSelector } from "@/components/creative-type-selector"
import { detectProductFromUrl } from "@/lib/product-webhooks"
import { getAds } from "./actions"
import { Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductFilterIndicator } from "@/components/product-filter-indicator"

interface AdArchiveBrowserProps {
  initialAds: Ad[]
  pages: string[]
}

export function AdArchiveBrowser({ initialAds, pages }: AdArchiveBrowserProps) {
  
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 20
  const totalAds = 100
  const [productFilter, setProductFilter] = useState<string>("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showAINewsModal, setShowAINewsModal] = useState(false)
  const [processingMessage, setProcessingMessage] = useState("")

  // 🎯 Стан для типу креативу
  const [selectedCreativeType, setSelectedCreativeType] = useState<"all" | "video" | "image">("all")

  // Отримуємо всі доступні теги з креативів
  const availableTags = Array.from(
    new Set(ads.filter((ad) => Array.isArray(ad.tags) && ad.tags.length > 0).flatMap((ad) => ad.tags || [])),
  ).sort()

  // 🎯 Фільтруємо креативи по типу
  const filteredAdsByType = ads.filter((ad) => {
    if (selectedCreativeType === "all") return true
    if (selectedCreativeType === "video") return ad.display_format === "VIDEO"
    if (selectedCreativeType === "image") return ad.display_format === "IMAGE"
    return true
  })

  const handleFilterChange = async (filters: FilterOptions) => {
    setIsLoading(true)
    try {
      const filteredAds = await getAds(filters.search, filters.page, filters.date, filters.tags)
      setAds(filteredAds)
    } catch (error) {
      console.error("Error filtering ads:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTagsChange = async (tags: string[]) => {
    setSelectedTags(tags)
    setIsLoading(true)
    try {
      const filteredAds = await getAds(productFilter || "", null, null, tags)
      setAds(filteredAds)
    } catch (error) {
      console.error("Error filtering by tags:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    const searchValue = productFilter.trim()

    if (!searchValue) {
      alert("Please enter a product name or Meta Ad Library link")
      return
    }

    const isMetaLink = searchValue.includes("facebook.com/ads/library")

    if (isMetaLink) {
      // 🎯 Показуємо модалку з інформацією без прив'язки до продукту
      const typeMessages = {
        all: `Analyzing link and extracting all creatives (video & static)...`,
        video: `Analyzing link and extracting VIDEO creatives only...`,
        image: `Analyzing link and extracting STATIC creatives only...`,
      }

      setProcessingMessage(typeMessages[selectedCreativeType])
      setShowAINewsModal(true)
      setIsLoading(true)

      try {
        const response = await fetch("/api/parse-meta-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metaLink: searchValue,
            creativeType: selectedCreativeType,
          }),
        })

        const result = await response.json()

        if (result.success) {
          // 🎯 Повідомлення про успіх без залежності від назви продукту
          const successMessages = {
            all: `Successfully processed link! New ads (video & static) will appear shortly.`,
            video: `Successfully processed link! New video ads will appear shortly.`,
            image: `Successfully processed link! New static ads will appear shortly.`,
          }

          setProcessingMessage(successMessages[selectedCreativeType])

          setTimeout(() => {
            setShowAINewsModal(false)
            window.location.reload()
          }, 3000)
        } else {
          setShowAINewsModal(false)
          alert(`Error processing link:\n\n${result.message || result.error}`)
        }
      } catch (error: unknown) {
        setShowAINewsModal(false)
        const message = error instanceof Error ? error.message : "Unknown error"
        alert("Error: " + message)
      } finally {
        setIsLoading(false)
      }
    } else {
      // Це назва продукту - фільтруємо локально
      setProductFilter(searchValue)
      setIsLoading(true)

      try {
        const filteredAds = await getAds(searchValue, null, null, selectedTags)
        setAds(filteredAds)
      } catch (error) {
        console.error("Error filtering ads:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      console.log(`Navigating to page ${page}`)
    }
  }

  const videoAds = filteredAdsByType.filter((ad) => ad.display_format === "VIDEO").length

  const clearProductFilter = async () => {
    setProductFilter("")
    setIsLoading(true)
    try {
      const allAds = await getAds("", null, null, selectedTags)
      setAds(allAds)
    } catch (error) {
      console.error("Error loading ads:", error)
    } finally {
      setIsLoading(false)
    }
  }

  interface GroupedAds {
    [imageKey: string]: Ad[]
  }

  // =============================================================================
  // Group ads by image and text
  
  // Function to get grouping key based on image and text
  const getGroupingKey = (ad: Ad): string => {
    // Створюємо ключ на основі image_url та text
    const imageKey = ad.image_url ? getImageKey(ad.image_url) : 'no-image';
    const textKey = ad.text ? ad.text.substring(0, 100).replace(/\s+/g, ' ').trim() : 'no-text';
    
    // Комбінуємо image та text ключі
    return `${imageKey}|${textKey}`;
  };

  // Function to get image key for grouping
  const getImageKey = (imageUrl: string): string => {
    // Extract the base URL before query parameters
    try {
        const url = new URL(imageUrl);
        // Get the pathname and remove the filename to get the base path
        const pathParts = url.pathname.split('/');
        // Take the first few parts of the path to group similar images
        const basePath = pathParts.slice(0, -1).join('/');
        return `${url.hostname}${basePath}`;
    } catch {
        // If URL parsing fails, use the first part of the URL
        return imageUrl.split('?')[0].split('/').slice(0, -1).join('/');
    }
};

  const groupAdsByImage = (ads: Ad[]): GroupedAds => {
    const grouped: GroupedAds = {};
    
    ads.forEach(ad => {
        const groupingKey = getGroupingKey(ad);
        if (!grouped[groupingKey]) {
            grouped[groupingKey] = [];
        }
        grouped[groupingKey].push(ad);
    });
    
    return grouped;
};

const GroupedAds = groupAdsByImage(ads)

// Debug: логуємо групування для перевірки
console.log("GroupedAds:", GroupedAds);
console.log("Number of groups:", Object.keys(GroupedAds).length);

// =============================================================================

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Hero section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">Creative Library</h1>
            <p className="text-slate-600 font-medium text-lg">
              Powered by <span className="text-blue-600 font-bold">TakeNap</span>
            </p>
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <PageNavigation currentPage="library" />
            <ProfileDropdown />
          </div>
        </div>

        {/* Product Filter Indicator */}
        {productFilter && <ProductFilterIndicator productName={productFilter} onClear={clearProductFilter} />}

        {/* Search Block with Creative Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Competitor Link */}
          <StatsBar
            totalAds={filteredAdsByType.length}
            videoAds={videoAds}
            uniquePages={pages.length}
            columnIndex={0}
            value={productFilter}
            onChange={(v) => setProductFilter(v)}
          />

          {/* Creative Type Selector - тепер у вигляді карточки */}
          <CreativeTypeSelector selectedType={selectedCreativeType} onTypeChange={setSelectedCreativeType} />
        </div>

        {/* ℹ️ Info Alert */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-900 font-medium">How it works:</p>
            <p className="text-sm text-blue-700 mt-1">
              1. Paste a <strong>Meta Ad Library link</strong> (we'll detect the product automatically)
              <br />
              2. Choose <strong>creative type</strong> (All / Video / Static)
              <br />
              3. Click <strong>Search</strong> to start processing
            </p>
          </div>
        </div>

        {/* Search Button + Filters */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Search Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSearch}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25 h-9 w-full flex items-center justify-center"
            >
              <Search className="h-4 w-4 mr-2" />
              {selectedCreativeType === "all"
                ? "Search All Types"
                : selectedCreativeType === "video"
                  ? "Search Videos Only"
                  : "Search Static Only"}
            </Button>
          </div>

          {/* Filters section */}
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

        {/* Bottom row - Stats, Pagination and View Toggle */}
        <div className="flex items-center justify-between w-full gap-4 mb-8">
          <p className="text-slate-500 text-sm font-medium">
            Showing <span className="font-semibold text-slate-700">{filteredAdsByType.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalAds}</span> ads
            {selectedCreativeType !== "all" && <span className="text-blue-600"> ({selectedCreativeType} only)</span>}
            {productFilter && <span className="text-blue-600"> for "{productFilter}"</span>}
            {selectedTags.length > 0 && <span className="text-purple-600"> with tags: {selectedTags.join(", ")}</span>}
          </p>

          <div className="flex items-center gap-4">
            {/* Pagination */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 rounded-md text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-600 font-medium px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 rounded-md text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* View Toggle */}
            <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
          </div>
        </div>

        {/* Results section */}
        {isLoading && !showAINewsModal ? (
          <div className="flex justify-center items-center h-64">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
              <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-8 ${
              viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            }`}
          >
            {Object.entries(GroupedAds).map(([imageKey, adsInGroup]) => {
              const primaryAd = adsInGroup[0];
              const relatedAds = adsInGroup.slice(1);
              return (
                <AdCard 
                  key={primaryAd.id} 
                  ad={primaryAd} 
                  relatedAds={relatedAds}
                />
              );
            })}
            {filteredAdsByType.length === 0 && (
              <div className="col-span-full text-center py-20">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No {selectedCreativeType === "all" ? "" : selectedCreativeType} ads found
                  </h3>
                  <p className="text-slate-500">
                    Try adjusting your search criteria or filters to find what you're looking for.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI News Modal */}
        <AINewsModal
          isOpen={showAINewsModal}
          onClose={() => setShowAINewsModal(false)}
          processingMessage={processingMessage}
        />
      </div>
    </div>
  )
}
