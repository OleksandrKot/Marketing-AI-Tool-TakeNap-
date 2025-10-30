"use client"

import { useState, useCallback, memo, useRef, useMemo } from "react"
import { useFavorites } from "@/lib/hooks/useFavorites"
import { useFolders } from "@/lib/hooks/useFolders"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ArrowLeft, Share2, Heart, Copy, Check, Layers } from "lucide-react"
import CollectionModal from "@/components/collection-modal"
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
  relatedAds?: Ad[] | null
}

const AdDetails = memo(function AdDetails({ ad, relatedAds }: AdDetailsProps) {
  const router = useRouter()
  const { isFavorite, toggleFavorite, addFavorite, removeFavorite } = useFavorites()
  const { folders: serverFolders, addItemToFolder, removeItemFromFolder } = useFolders()
  const creativeId = ad.ad_archive_id || ad.id.toString()
  const isLiked = isFavorite(creativeId)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false)
  const [showFavMenu, setShowFavMenu] = useState(false)
  const heartRef = useRef<HTMLButtonElement | null>(null)

  const membership = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const f of serverFolders || []) {
      const ids = ((f as any).folder_items || []).map((i: any) => i.creative_id)
      map[f.id] = ids.includes(creativeId)
    }
    return map
  }, [serverFolders, creativeId])
  const [activeTab, setActiveTab] = useState<"content" | "info" | "adaptations">("content")
  const [copiedAdId, setCopiedAdId] = useState(false)

  const handleBack = useCallback(() => {
    router.push("/") // Замість router.back()
  }, [router])

  const handleLike = useCallback(() => {
    // open small dropdown menu offering folders and local favorites
    setShowFavMenu((s) => !s)
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
              <div className="relative">
                <Button
                  ref={heartRef}
                  variant="ghost"
                  size="icon"
                  onClick={handleLike}
                  className={`transition-colors ${isLiked ? "text-red-500 hover:text-red-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
                </Button>

                {showFavMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border rounded-md shadow-lg z-50">
                    <div className="p-2 border-b text-sm text-slate-600">Add to...</div>
                    <div className="max-h-56 overflow-auto">
                      <button
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${isFavorite(creativeId) ? 'font-medium' : ''}`}
                        onClick={() => {
                          if (isFavorite(creativeId)) removeFavorite(creativeId)
                          else addFavorite(creativeId)
                          setShowFavMenu(false)
                        }}
                      >
                        <span>Favorites (local)</span>
                        {isFavorite(creativeId) && <span className="text-xs text-green-600">Added</span>}
                      </button>
                      {serverFolders && serverFolders.length > 0 ? (
                        serverFolders.map((f) => (
                          <div key={f.id} className="px-2">
                            <button
                              className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${membership[f.id] ? 'font-medium' : ''}`}
                              onClick={() => {
                                try {
                                  if (membership[f.id]) removeItemFromFolder(f.id, creativeId)
                                  else addItemToFolder(f.id, creativeId)
                                } catch (e) {
                                  console.error(e)
                                }
                                setShowFavMenu(false)
                              }}
                            >
                              <span>{f.name}</span>
                              {membership[f.id] && <span className="text-xs text-green-600">In folder</span>}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-slate-500">No folders yet</div>
                      )}
                    </div>
                    <div className="p-2 border-t text-right">
                      <button className="text-sm text-slate-500 hover:underline" onClick={() => { setShowFavMenu(false); setShowCollectionsModal(true) }}>Manage collections</button>
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCollectionsModal(true)}
                className="text-slate-400 hover:text-slate-600"
                title="Add to collections"
              >
                <Layers className="h-5 w-5" />
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
