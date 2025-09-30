"use client"

import { useState, useCallback, memo } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ArrowLeft, Share2, Heart, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreativeTabs } from "@/components/creative-tabs"
import { ContentTab } from "./content-tab"
import { InfoTab } from "./info-tab"
import { AdaptationsTab } from "./adaptations-tab"
import { TagManager } from "./tag-manager"
import type { Ad } from "@/lib/types"

// Динамічне завантаження компонентів, які не потрібні одразу
const ShareModal = dynamic(() => import("./share-modal"), {
  loading: () => <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />,
})

interface AdDetailsProps {
  ad: Ad
}

const AdDetails = memo(function AdDetails({ ad }: AdDetailsProps) {
  const router = useRouter()
  const [isLiked, setIsLiked] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [activeTab, setActiveTab] = useState<"content" | "info" | "adaptations">("content")
  const [copiedAdId, setCopiedAdId] = useState(false)

  const handleBack = useCallback(() => {
    router.push("/") // Замість router.back()
  }, [router])

  const handleLike = useCallback(() => {
    setIsLiked((prev) => !prev)
  }, [])

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
              variant="ghost"
              onClick={handleBack}
              className="mr-4 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Library
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">{ad.title || "Creative Details"}</h1>
              <div className="flex items-center space-x-2">
                <p className="text-slate-500 font-medium">Ad ID: {ad.ad_archive_id || ad.id}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAdId}
                  className="text-slate-500 hover:text-slate-700 h-6 w-6 p-0"
                >
                  {copiedAdId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Tag Manager - показуємо тільки на content tab */}
            {activeTab === "content" && (
              <div className="relative group">
                <TagManager ad={ad} onTagsUpdate={handleTagsUpdate} />
              </div>
            )}

            {/* Like and Share buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLike}
                className={`transition-colors ${
                  isLiked ? "text-red-500 hover:text-red-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleShare} className="text-slate-400 hover:text-slate-600">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <CreativeTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === "content" && <ContentTab ad={ad} />}
        {activeTab === "info" && <InfoTab ad={ad} />}
        {activeTab === "adaptations" && <AdaptationsTab ad={ad} />}

        {/* Share Modal */}
        {showShareModal && <ShareModal ad={ad} onClose={() => setShowShareModal(false)} />}
      </div>
    </div>
  )
})

export { AdDetails }
