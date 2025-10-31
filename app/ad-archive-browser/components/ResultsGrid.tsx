"use client"

import { AdCard } from "@/components/ad-card"
import { AINewsModal } from "@/components/ai-news-modal"
import { Search } from "lucide-react"
import type { Ad } from "@/lib/types"

type Props = {
  isLoading: boolean
  showAINewsModal: boolean
  processingMessage: string
  viewMode: string
  currentPageAds: Ad[]
  adIdToGroupMap: Record<string, Ad[]>
  filteredAdsByType: Ad[]
  selectedCreativeType: string
  onCloseModal?: () => void
}

export default function ResultsGrid({
  isLoading,
  showAINewsModal,
  processingMessage,
  viewMode,
  currentPageAds,
  adIdToGroupMap,
  filteredAdsByType,
  selectedCreativeType,
  onCloseModal,
}: Props) {
  return (
    <>
      {isLoading && !showAINewsModal ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
          </div>
        </div>
      ) : (
        <div className={`grid gap-8 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
          {currentPageAds.map((ad: Ad) => {
            const fullGroup = adIdToGroupMap[ad.id] ?? []
            const relatedAds = fullGroup.filter((a: Ad) => a.id !== ad.id)
            return <AdCard key={ad.id} ad={ad} relatedAds={relatedAds} />
          })}

          {filteredAdsByType.length === 0 && (
            <div className="col-span-full text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No {selectedCreativeType === "all" ? "" : selectedCreativeType} ads found</h3>
                <p className="text-slate-500">Try adjusting your search criteria or filters to find what you're looking for.</p>
              </div>
            </div>
          )}
        </div>
      )}

  <AINewsModal isOpen={showAINewsModal} onClose={onCloseModal || (() => {})} processingMessage={processingMessage} />
    </>
  )
}
