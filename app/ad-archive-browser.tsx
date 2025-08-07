"use client"

import { useState } from "react"
import type { Ad, FilterOptions, ViewMode } from "@/lib/types"
import { AdCard } from "@/components/ad-card"
import { FilterBar } from "@/components/filter-bar"
import { ViewToggle } from "@/components/view-toggle"
import { StatsBar } from "@/components/stats-bar"
import { ProfileDropdown } from "@/components/profile-dropdown"
import { PageNavigation } from "@/components/page-navigation"
import { getAds } from "./actions"
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from "@/components/ui/button"

interface AdArchiveBrowserProps {
  initialAds: Ad[]
  pages: string[]
}

export function AdArchiveBrowser({ initialAds, pages }: AdArchiveBrowserProps) {
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 20 // This would be calculated based on total ads and items per page
  const totalAds = 100 // This would come from your data source

  const handleFilterChange = async (filters: FilterOptions) => {
    setIsLoading(true)
    try {
      const filteredAds = await getAds(filters.search, filters.page, filters.date)
      setAds(filteredAds)
    } catch (error) {
      console.error("Error filtering ads:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    const competitorLinkInput = document.querySelector('input[placeholder*="Meta Ad Library"]') as HTMLInputElement
    const metaLink = competitorLinkInput?.value

    if (!metaLink || !metaLink.includes("facebook.com/ads/library")) {
      alert("Please enter a valid Meta Ad Library link")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/parse-meta-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metaLink }),
      })

      const result = await response.json()

      if (result.success) {
        alert("Link sent for processing! New ads will appear shortly.")
        // Оновити список креативів через 10 секунд
        setTimeout(() => {
          window.location.reload()
        }, 30000) // Збільшено до 30 секунд
      } else {
        alert("Error processing link: " + result.error)
      }
    } catch (error) {
      alert("Error: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      // Add logic to fetch ads for the specific page
      console.log(`Navigating to page ${page}`)
    }
  }

  const videoAds = ads.filter((ad) => ad.display_format === "VIDEO").length

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

        {/* Top row - Creative Format, Date of Creation, and Competitor Link */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          {/* Competitor Link */}
          <StatsBar totalAds={ads.length} videoAds={videoAds} uniquePages={pages.length} columnIndex={0} />

          {/* Date of Creation */}
          <StatsBar totalAds={ads.length} videoAds={videoAds} uniquePages={pages.length} columnIndex={2} />

          {/* Creative Format */}
          <StatsBar totalAds={ads.length} videoAds={videoAds} uniquePages={pages.length} columnIndex={1} />
        </div>

        {/* Bottom row - Search button and Filters section */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Search Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSearch}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25 h-9 w-full flex items-center justify-center"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Filters section */}
          <div className="md:col-span-2 flex justify-start w-full">
            <FilterBar onFilterChange={handleFilterChange} pages={pages} className="w-full" />
          </div>
        </div>

        {/* Bottom row - Stats, Pagination and View Toggle */}
        <div className="flex items-center justify-between w-full gap-4 mb-8">
          <p className="text-slate-500 text-sm font-medium">
            Showing <span className="font-semibold text-slate-700">{ads.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{ads.length}</span> ads{" "}
            <span className="text-slate-400">({totalAds} ads total)</span>
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
        {isLoading ? (
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
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
            {ads.length === 0 && (
              <div className="col-span-full text-center py-20">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No ads found</h3>
                  <p className="text-slate-500">
                    Try adjusting your search criteria or filters to find what you're looking for.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
