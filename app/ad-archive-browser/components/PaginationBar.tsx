"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ViewToggle } from "@/components/view-toggle"

type Props = {
  visibleAdsCount: number
  totalAds: number
  currentPageAdsCount: number
  currentPage: number
  totalPages: number
  onPageChange: (p: number) => void
  viewMode: string
  setViewMode: (v: any) => void
  selectedCreativeType: string
  productFilter: string
  selectedTags: string[]
}

export default function PaginationBar({
  visibleAdsCount,
  totalAds,
  currentPageAdsCount,
  currentPage,
  totalPages,
  onPageChange,
  viewMode,
  setViewMode,
  selectedCreativeType,
  productFilter,
  selectedTags,
}: Props) {
  return (
    <div className="flex items-center justify-between w-full gap-4 mb-8">
      <p className="text-slate-500 text-sm font-medium">
        Showing <span className="font-semibold text-slate-700">{visibleAdsCount}</span> of {" "}
        <span className="font-semibold text-slate-700">{totalAds}</span> ads {" "}
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
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 rounded-md text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-600 font-medium px-2">Page {currentPage} of {totalPages}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0 rounded-md text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-50 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <ViewToggle currentView={viewMode as any} onViewChange={setViewMode as any} />
      </div>
    </div>
  )
}
