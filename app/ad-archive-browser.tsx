"use client"

import { useState, useEffect, useRef } from "react"
import type { Ad, FilterOptions, ViewMode } from "@/lib/types"
import { AdCard } from "@/components/ad-card"
import { FilterBar } from "@/components/filter-bar"
import { ViewToggle } from "@/components/view-toggle"
import { StatsBar } from "@/components/stats-bar"
import { ProfileDropdown } from "@/components/profile-dropdown"
import { PageNavigation } from "@/components/page-navigation"
import { AINewsModal } from "@/components/ai-news-modal"
import { CreativeTypeSelector } from "@/components/creative-type-selector"
import { getAds } from "./actions"
import { Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductFilterIndicator } from "@/components/product-filter-indicator"

interface AdArchiveBrowserProps {
  initialAds: Ad[]
  pages: string[]
}

/**
 * Компонент: AdArchiveBrowser
 * - Пагінація робиться по "raw" (незгрупованих) оголошеннях
 * - Кожному оголошенню передається його група (relatedAds), якщо така є
 */
export function AdArchiveBrowser({ initialAds, pages }: AdArchiveBrowserProps) {
  // State
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12
  const [productFilter, setProductFilter] = useState<string>("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showAINewsModal, setShowAINewsModal] = useState(false)
  const [processingMessage, setProcessingMessage] = useState("")
  const [selectedCreativeType, setSelectedCreativeType] = useState<"all" | "video" | "image">("all")

  // Доступні теги (зі списку ads)
  const availableTags = Array.from(
    new Set(ads.filter((ad) => Array.isArray(ad.tags) && ad.tags.length > 0).flatMap((ad) => ad.tags || [])),
  ).sort()

  // Фільтр по типу креативу
  const filteredAdsByType = ads.filter((ad) => {
    if (selectedCreativeType === "all") return true
    if (selectedCreativeType === "video") return ad.display_format === "VIDEO"
    if (selectedCreativeType === "image") return ad.display_format === "IMAGE"
    return true
  })

  // Допоміжні: формування ключа для групування (image + короткий текст)
  const getImageKey = (imageUrl: string): string => {
    try {
      const url = new URL(imageUrl)
      const parts = url.pathname.split("/")
      const basePath = parts.slice(0, -1).join("/")
      return `${url.hostname}${basePath}`
    } catch {
      return imageUrl.split("?")[0].split("/").slice(0, -1).join("/")
    }
  }

  const getGroupingKey = (ad: Ad): string => {
    const imageKey = ad.image_url ? getImageKey(ad.image_url) : "no-image"
    const textKey = ad.text ? ad.text.substring(0, 100).replace(/\s+/g, " ").trim() : "no-text"
    return `${imageKey}|${textKey}`
  }

  // Group map: groupingKey -> Ad[]
  // Також створимо map: adId -> group's array (щоб швидко доставати relatedAds)
  const groupedAll = (() => {
    const map = new Map<string, Ad[]>()
    for (const ad of filteredAdsByType) {
      const key = getGroupingKey(ad)
      const arr = map.get(key)
      if (arr) arr.push(ad)
      else map.set(key, [ad])
    }
    return map
  })()

  const adIdToGroupMap: Record<string, Ad[]> = {}
  groupedAll.forEach((groupAds, key) => {
    for (const ad of groupAds) {
      adIdToGroupMap[ad.id] = groupAds
    }
  })

  // ПАГІНАЦІЯ ПО НЕЗГРУПОВАНИХ (raw) ADS
  // - Розбиваємо filteredAdsByType на сторінки (чисті елементи)
  const chunk = (arr: Ad[], size: number): Ad[][] => {
    const out: Ad[][] = []
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size))
    }
    return out
  }

  const ungroupedPages = chunk(filteredAdsByType, itemsPerPage)
  const totalPages = Math.max(1, ungroupedPages.length)

  // Синхронізуємо currentPage при зміні totalPages
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  // Поточна сторінка: список окремих оголошень
  const currentPageAds = ungroupedPages[currentPage - 1] || []

  // Кількість оголошень на поточній сторінці (реальна)
  const currentPageAdsCount = currentPageAds.length

  // Кількість видимих оголошень від початку до поточної сторінки (включно)
  const visibleAdsCount = ungroupedPages.slice(0, currentPage).reduce((sum, pg) => sum + pg.length, 0)

  // Загальна кількість оголошень після фільтрації
  const totalAds = filteredAdsByType.length

  // Пагінація: зміна сторінки
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  // Фільтри / Пошук 
  const handleFilterChange = async (filters: FilterOptions) => {
    setIsLoading(true)
    try {
      const filtered = await getAds(filters.search, filters.page, filters.date, filters.tags)
      setAds(filtered)
      setCurrentPage(1)
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
      const filtered = await getAds(productFilter || "", null, null, tags)
      setAds(filtered)
      setCurrentPage(1)
    } catch (error) {
      console.error("Error filtering by tags:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    const searchValue = productFilter.trim()
    
    // Always allow empty search to reset results
    if (!searchValue && selectedTags.length === 0) {
      try {
        const allAds = await getAds(undefined, null, null, undefined)
        setAds(allAds)
        setCurrentPage(1)
      } catch (error) {
        console.error("Error resetting ads:", error)
      }
      return
    }

    const isMetaLink = searchValue.includes("facebook.com/ads/library")

    if (isMetaLink) {
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metaLink: searchValue, creativeType: selectedCreativeType }),
        })
        const result = await response.json()

        if (result.success) {
          const successMessages = {
            all: `Successfully processed link! New ads (video & static) will appear shortly.`,
            video: `Successfully processed link! New video ads will appear shortly.`,
            image: `Successfully processed link! New static ads will appear shortly.`,
          }
          setProcessingMessage(successMessages[selectedCreativeType])
          setTimeout(() => {
            setShowAINewsModal(false)
            // краще оновити список через API — але поки робимо reload
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
      setIsLoading(true)
      try {
        const filtered = await getAds(
          searchValue || undefined,  // Only pass search if it's not empty
          null, 
          null, 
          selectedTags.length ? selectedTags : undefined  // Only pass tags if any selected
        )
        setAds(filtered)
        setCurrentPage(1)
      } catch (error) {
        console.error("Error filtering ads:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const videoAds = filteredAdsByType.filter((ad) => ad.display_format === "VIDEO").length

  // Debounced search using a ref to store timeout id
  const searchTimeout = useRef<number | null>(null)

  const handleProductFilterChange = (value: string) => {
    setProductFilter(value)

    // clear previous timeout
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current)
      searchTimeout.current = null
    }

    // schedule new search
    const id = window.setTimeout(async () => {
      setIsLoading(true)
      try {
        const filtered = await getAds(
          value || undefined,
          null,
          null,
          selectedTags.length > 0 ? selectedTags : undefined,
        )
        setAds(filtered)
        setCurrentPage(1)
      } catch (error) {
        console.error("Error filtering ads:", error)
      } finally {
        setIsLoading(false)
      }
    }, 300)
    searchTimeout.current = id
  }

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current)
      }
    }
  }, [])

  const clearProductFilter = async () => {
    setProductFilter("")
    setIsLoading(true)
    try {
      const allAds = await getAds("", null, null, selectedTags)
      setAds(allAds)
      setCurrentPage(1)
    } catch (error) {
      console.error("Error loading ads:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // JSX
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
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

        {/* Product filter chip */}
        {productFilter && <ProductFilterIndicator productName={productFilter} onClear={clearProductFilter} />}

        {/* Search + creative type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <StatsBar
            totalAds={filteredAdsByType.length}
            videoAds={videoAds}
            uniquePages={pages.length}
            columnIndex={0}
            value={productFilter}
            onChange={handleProductFilterChange}
            onEnterPress={handleSearch}
          />
          <CreativeTypeSelector selectedType={selectedCreativeType} onTypeChange={setSelectedCreativeType} />
        </div>

        {/* Info */}
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

        {/* Search button + filters */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
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

        {/* Bottom row - accurate stats + pagination + view toggle */}
        <div className="flex items-center justify-between w-full gap-4 mb-8">
          <p className="text-slate-500 text-sm font-medium">
            {/* visibleAdsCount — фактичні елементи від початку до поточної сторінки;
                totalAds — загальна кількість після фільтрації;
                currentPageAdsCount — кількість на поточній сторінці (реальна). */}
            Showing <span className="font-semibold text-slate-700">{visibleAdsCount}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalAds}</span> ads{" "}
            <span className="text-slate-400">({currentPageAdsCount} on this page)</span>
            {selectedCreativeType !== "all" && <span className="text-blue-600"> ({selectedCreativeType} only)</span>}
            {productFilter && <span className="text-blue-600"> for "{productFilter}"</span>}
            {selectedTags.length > 0 && <span className="text-purple-600"> with tags: {selectedTags.join(", ")}</span>}
          </p>

          <div className="flex items-center gap-4">
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

            <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
          </div>
        </div>

        {/* Results (тут рендеримо індивідуальні оголошення, але передаємо relatedAds) */}
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
            {currentPageAds.map((ad) => {
              // Витягуємо групу цього оголошення (якщо є) і виключаємо сам поточний ad
              const fullGroup = adIdToGroupMap[ad.id] ?? []
              const relatedAds = fullGroup.filter((a) => a.id !== ad.id)
              return <AdCard key={ad.id} ad={ad} relatedAds={relatedAds} />
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
        <AINewsModal isOpen={showAINewsModal} onClose={() => setShowAINewsModal(false)} processingMessage={processingMessage} />
      </div>
    </div>
  )
}
