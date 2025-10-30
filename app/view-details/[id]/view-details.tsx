"use client"

import { useState, useCallback, memo } from "react"
import { useFavorites } from "@/lib/hooks/useFavorites"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Image from "next/image"
import {
  ArrowLeft,
  Video,
  Download,
  Share2,
  Heart,
  RotateCcw,
  Calendar,
  Clock,
  Info,
  Link,
  Play,
  ImageIcon,
  Mic,
  Film,
  Eye,
  ExternalLink,
  Copy,
  Check,
  Layers,
} from "lucide-react"
import CollectionModal from "@/components/collection-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import type { Ad } from "@/lib/types"

// Динамічне завантаження компонентів
const ShareModal = dynamic(() => import("../../creative/[id]/share-modal"), {
  loading: () => <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />,
})

interface ViewDetailsProps {
  ad: Ad
}

const ViewDetails = memo(function ViewDetails({ ad }: ViewDetailsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const { isFavorite, toggleFavorite } = useFavorites()
  const creativeId = ad.ad_archive_id || ad.id.toString()
  const [isLikedLocal, setIsLikedLocal] = useState(false)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false)
  // derive persistent liked state from store
  const isLiked = isFavorite(creativeId) || isLikedLocal
  const [showShareModal, setShowShareModal] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const isVideo = ad.display_format === "VIDEO"
  const createdDate = new Date(ad.created_at)
  const today = new Date()
  const activeDays = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

  const handleBack = useCallback(() => {
    router.push("/")
  }, [router])

  const handleDownload = useCallback(async () => {
    const urlToDownload = isVideo ? ad.video_hd_url : ad.image_url
    if (!urlToDownload) return

    setIsLoading(true)
    try {
      const response = await fetch(urlToDownload)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${ad.title || "creative"}.${isVideo ? "mp4" : "jpg"}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Download failed:", error)
    } finally {
      setIsLoading(false)
    }
  }, [ad.video_hd_url, ad.image_url, ad.title, isVideo])

  const handleLike = useCallback(() => {
    // toggle persistent favorite
    toggleFavorite(creativeId)
    // keep a tiny local flicker for immediate UI when storage events are slow
    setIsLikedLocal((p) => !p)
    // clear the local flicker after a short time so store value is authoritative
    setTimeout(() => setIsLikedLocal(false), 500)
  }, [toggleFavorite, creativeId])

  const handleShare = useCallback(() => {
    setShowShareModal(true)
  }, [])

  const handleRestartVideo = useCallback(() => {
    const video = document.querySelector("video")
    if (video) {
      video.currentTime = 0
      video.play()
    }
  }, [])

  const handleCopyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }, [])

  const previewImage = ad.image_url || ad.video_preview_image_url || "/placeholder.svg"

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
              <p className="text-slate-500 font-medium">{ad.page_name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLike}
              className={`transition-colors ${isLiked ? "text-red-500 hover:text-red-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
            </Button>
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Media & Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Media Player */}
            <Card className="overflow-hidden border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-slate-100">
                  {isVideo && ad.video_hd_url ? (
                    <video
                      src={ad.video_hd_url}
                      poster={previewImage || undefined}
                      controls
                      preload="metadata"
                      className="w-full h-full object-contain"
                      onLoadedData={() => setVideoLoaded(true)}
                      style={{ display: videoLoaded ? "block" : "none" }}
                    />
                  ) : previewImage ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={previewImage || "/placeholder.svg"}
                        alt={ad.title || "Ad preview"}
                        fill
                        className="object-contain transition-opacity duration-300"
                        style={{ opacity: imageLoaded ? 1 : 0 }}
                        onLoad={() => setImageLoaded(true)}
                        priority
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 50vw"
                      />
                      {!imageLoaded && <div className="absolute inset-0 bg-slate-200 animate-pulse" />}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Video className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500">No preview available</p>
                      </div>
                    </div>
                  )}

                  {(isVideo && !videoLoaded) || (!isVideo && !imageLoaded) ? (
                    <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
                      <div className="text-slate-400">Loading...</div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Media Controls */}
            <div className="flex gap-4">
              {isVideo && ad.video_hd_url && (
                <Button
                  onClick={handleRestartVideo}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restart Video
                </Button>
              )}
              {(ad.video_hd_url || ad.image_url) && (
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 font-medium rounded-xl h-11 transition-all duration-200 bg-transparent"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isLoading ? "Downloading..." : `Download ${isVideo ? "Video" : "Image"}`}
                </Button>
              )}
              {ad.link_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(ad.link_url, "_blank", "noopener,noreferrer")}
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-medium rounded-xl h-11 transition-all duration-200"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visit Landing
                </Button>
              )}
            </div>

            {/* Ad Text */}
            {ad.text && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-blue-50 p-6 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-slate-900">Ad Text</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToClipboard(ad.text, "text")}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copiedField === "text" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{ad.text}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Duplicate Ad Text */}
            {ad.duplicates_ad_text && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-blue-50 p-6 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-slate-900">Duplicate Ad Text</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToClipboard(ad.duplicates_ad_text!, "duplicates_ad_text")}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copiedField === "duplicates_ad_text" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{ad.duplicates_ad_text}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Caption */}
            {ad.caption && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-emerald-50 p-6 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-slate-900">Caption</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToClipboard(ad.caption, "caption")}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copiedField === "caption" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{ad.caption}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Call to Action */}
            {ad.cta_text && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-orange-50 p-6 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">Call to Action</h2>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200">
                        {ad.cta_text}
                      </Button>
                      <div className="text-sm text-slate-500">
                        Type: <span className="font-medium text-slate-700">{ad.cta_type || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Details & Scripts */}
          <div className="space-y-6">
            {/* Creative Information */}
            <Card className="border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                <div className="bg-blue-50 p-6 border-b border-slate-200">
                  <div className="flex items-center">
                    <Info className="h-5 w-5 text-blue-600 mr-2" />
                    <h2 className="text-xl font-semibold text-slate-900">Creative Info</h2>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Format</h3>
                    <Badge
                      className={`${
                        isVideo
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      } font-medium px-3 py-1.5 rounded-full border`}
                    >
                      {isVideo ? (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Video
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-3 w-3 mr-1" />
                          Image
                        </>
                      )}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Created Date</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                      <p className="text-slate-900 font-medium">{formatDate(ad.created_at)}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Active Days</h3>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-slate-400" />
                      <p className="text-slate-900 font-medium">{activeDays} days</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Platform</h3>
                    <p className="text-slate-900 font-medium">{ad.publisher_platform || "N/A"}</p>
                  </div>

                  {ad.ad_archive_id && (
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h3 className="text-sm font-medium text-slate-500 mb-2">Archive ID</h3>
                      <div className="flex items-center justify-between">
                        <p className="text-slate-900 font-mono text-sm break-all">{ad.ad_archive_id}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyToClipboard(ad.ad_archive_id, "archive_id")}
                          className="text-slate-500 hover:text-slate-700 ml-2"
                        >
                          {copiedField === "archive_id" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Links */}
            {(ad.link_url || ad.meta_ad_url) && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-emerald-50 p-6 border-b border-slate-200">
                    <div className="flex items-center">
                      <Link className="h-5 w-5 text-emerald-600 mr-2" />
                      <h2 className="text-xl font-semibold text-slate-900">Links</h2>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {ad.link_url && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-500 mb-2">Landing Page</h3>
                        <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                          <a
                            href={ad.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm break-all flex-1 mr-2"
                          >
                            {ad.link_url}
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(ad.link_url!, "link_url")}
                            className="text-slate-500 hover:text-slate-700"
                          >
                            {copiedField === "link_url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    {ad.meta_ad_url && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-500 mb-2">Meta Ad Library</h3>
                        <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                          <a
                            href={ad.meta_ad_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm break-all flex-1 mr-2"
                          >
                            {ad.meta_ad_url}
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(ad.meta_ad_url!, "meta_ad_url")}
                            className="text-slate-500 hover:text-slate-700"
                          >
                            {copiedField === "meta_ad_url" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Audio Script - ТІЛЬКИ ТУТ! */}
            {ad.audio_script && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-purple-50 p-6 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Mic className="h-5 w-5 text-purple-600 mr-2" />
                        <h2 className="text-xl font-semibold text-slate-900">Audio Script</h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToClipboard(ad.audio_script!, "audio_script")}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copiedField === "audio_script" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{ad.audio_script}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Video Script - ТІЛЬКИ ТУТ! */}
            {ad.video_script && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-red-50 p-6 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Film className="h-5 w-5 text-red-600 mr-2" />
                        <h2 className="text-xl font-semibold text-slate-900">Video Script</h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToClipboard(ad.video_script!, "video_script")}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copiedField === "video_script" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{ad.video_script}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Image Description - ТІЛЬКИ ТУТ! */}
            {ad.image_description && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-yellow-50 p-6 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Eye className="h-5 w-5 text-yellow-600 mr-2" />
                        <h2 className="text-xl font-semibold text-slate-900">Image Description</h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToClipboard(ad.image_description!, "image_description")}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {copiedField === "image_description" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{ad.image_description}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Share Modal */}
        {showShareModal && <ShareModal ad={ad} onClose={() => setShowShareModal(false)} />}
        {showCollectionsModal && (
          <CollectionModal isOpen={showCollectionsModal} onClose={() => setShowCollectionsModal(false)} creativeId={creativeId} />
        )}
      </div>
    </div>
  )
})

export { ViewDetails }
