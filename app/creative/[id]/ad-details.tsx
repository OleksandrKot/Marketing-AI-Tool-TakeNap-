"use client"

import { useState, useCallback, memo } from "react"
// favorites handled by HeartButton component
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ArrowLeft, Share2, Layers } from "lucide-react"
import CollectionModal from "@/components/modals/collection-modal"
import { HeartButton } from "@/app/favorites/components/HeartButton"
import { Button } from "@/components/ui/button"
import { CreativeTabs } from "@/components/creative-tabs"
import { ContentTab } from "./content-tab"
import { InfoTab } from "./info-tab"
import { AdaptationsTab } from "./adaptations-tab"
// tag manager removed from header for simplified detail view
import type { Ad } from "@/lib/types"

// Динамічне завантаження компонентів, які не потрібні одразу
const ShareModal = dynamic(() => import("./share-modal"), {
  loading: () => <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />,
})

interface AdDetailsProps {
  ad: Ad
  relatedAds?: Ad[] | null
}

const AdDetails = memo(function AdDetails({ ad, relatedAds }: AdDetailsProps) {
  const router = useRouter()
  // Normalize creative id to string to avoid mismatches (some ads have numeric ad_archive_id)
  const creativeId = String(ad.ad_archive_id ?? ad.id)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false)
  const [activeTab, setActiveTab] = useState<"content" | "info" | "adaptations">("content")
  const [copiedAdId, setCopiedAdId] = useState(false)

  const handleBack = useCallback(() => {
    router.push("/") // Замість router.back()
  }, [router])

  const handleShare = useCallback(() => {
    setShowShareModal(true)
  }, [])

  const handleCopyAdId = useCallback(async () => {
    const adId = ad.ad_archive_id || ad.id.toString()
    const metaUrl = ad.meta_ad_url || `https://www.facebook.com/ads/library/?id=${adId}`

    try {
      await navigator.clipboard.writeText(metaUrl)
      setCopiedAdId(true)
      setTimeout(() => setCopiedAdId(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }, [ad.ad_archive_id, ad.id, ad.meta_ad_url])

  const handleTagsUpdate = useCallback(
    async (tags: string[]) => {
      // Тут додаємо реальне збереження тегів
      try {
        // Симулюємо API запит для збереження тегів
        const response = await fetch(`/api/ads/${ad.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tags }),
        })

        if (response.ok) {
          console.log("Tags saved successfully:", tags)
          // Можна додати toast notification про успішне збереження
        } else {
          console.error("Failed to save tags")
        }
      } catch (error) {
        console.error("Error saving tags:", error)
      }
    },
    [ad.id],
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button
              onClick={handleBack}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-4 mr-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Library
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">{ad.title || "Creative Details"}</h1>
              {/* simplified header: no ad metadata shown here */}
              <div />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Actions: favorite and share/collection (stylized in blue) */}
            <div className="flex items-center space-x-2">
              <HeartButton creativeId={creativeId} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCollectionsModal(true)}
                className="text-blue-600 hover:text-blue-800"
                title="Add to collections"
              >
                <Layers className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleShare} className="text-blue-600 hover:text-blue-800">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <CreativeTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === "content" && <ContentTab ad={ad} relatedAds={relatedAds} />}
        {activeTab === "info" && <InfoTab ad={ad} />}
        {activeTab === "adaptations" && <AdaptationsTab ad={ad} />}

        {/* Share Modal */}
        {showShareModal && <ShareModal ad={ad} onClose={() => setShowShareModal(false)} />}
        {showCollectionsModal && (
          <CollectionModal isOpen={showCollectionsModal} onClose={() => setShowCollectionsModal(false)} creativeId={creativeId} />
        )}
      </div>
    </div>
  )
})

export { AdDetails }
