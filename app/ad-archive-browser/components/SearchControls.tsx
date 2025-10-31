"use client"

import { StatsBar } from "@/components/stats-bar"
import { CreativeTypeSelector } from "@/components/creative-type-selector"
import { Button } from "@/components/ui/button"
import { FilterBar } from "@/components/filter-bar"
import { Search } from "lucide-react"
import type { FilterOptions } from "@/lib/types"

type Props = {
  productFilter: string
  onProductFilterChange: (v: string) => void
  onSearch: () => void
  selectedCreativeType: "all" | "video" | "image"
  setSelectedCreativeType: (v: "all" | "video" | "image") => void
  handleFilterChange: (filters: FilterOptions) => Promise<void>
  availableTags: string[]
  selectedTags: string[]
  handleTagsChange: (tags: string[]) => Promise<void>
  pagesLength: number
  pages: string[]
  filteredAdsCount: number
  videoAds: number
  clearProductFilter: () => Promise<void> | void
  onProductFilterChangeImmediate?: (v: string) => void
}

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
  clearProductFilter,
}: Props) {
  return (
    <>
      {productFilter && <div className="mb-4"><div className="inline-block"><span /></div></div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatsBar
          totalAds={filteredAdsCount}
          videoAds={videoAds}
          uniquePages={pagesLength}
          columnIndex={0}
          value={productFilter}
          onChange={onProductFilterChange}
          onEnterPress={onSearch}
        />
        <CreativeTypeSelector selectedType={selectedCreativeType} onTypeChange={setSelectedCreativeType} />
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3">
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

      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="flex justify-center">
          <Button
            onClick={onSearch}
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
    </>
  )
}
