"use client"

import { useState, useCallback, memo } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Image from "next/image"
import { ArrowLeft, Video, Download, Share2, Heart, RotateCcw, Calendar, Clock, Info, Hash, Type, Link, Play, ImageIcon, Mic, Film } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import type { Ad } from "@/lib/types"

// Динамічне завантаження компонентів, які не потрібні одразу
const ShareModal = dynamic(() => import("./share-modal"), {
  loading: () => <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />,
})

interface AdDetailsProps {
  ad: Ad
}

// Мемоізований компонент для оптимізації рендерингу
const AdDetails = memo(function AdDetails({ ad }: AdDetailsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Мемоізовані обчислення
  const isVideo = ad.display_format === "VIDEO"
  const createdDate = new Date(ad.created_at)
  const today = new Date()
  const activeDays = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

  // Оптимізовані обробники подій
  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleDownload = useCallback(async () => {
    const urlToDownload = isVideo ? ad.video_hd_url : ad.image_url;
    if (!urlToDownload) return;

    setIsLoading(true);
    try {
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ad.title || "creative"}.${isVideo ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [ad.video_hd_url, ad.image_url, ad.title, isVideo]);

  const handleLike = useCallback(() => {
    setIsLiked((prev) => !prev)
    // Тут можна додати API виклик для збереження лайку
  }, [])

  const handleShare = useCallback(() => {
    setShowShareModal(true)
  }, [])

  const handleVisitLanding = useCallback(() => {
    if (ad.link_url) {
      window.open(ad.link_url, "_blank", "noopener,noreferrer")
    }
  }, [ad.link_url])

  const handleRestartVideo = useCallback(() => {
    const video = document.querySelector("video")
    if (video) {
      video.currentTime = 0
      video.play()
    }
  }, [])

  // Використовуємо ad.image_url для прев'ю, якщо доступно, інакше video_preview_image
  const previewImage = ad.image_url || ad.video_preview_image || "/placeholder.svg"

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header with back button */}
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
            <h1 className="text-3xl font-bold text-slate-900 mb-0">Creative Details</h1>
          </div>

          {/* Quick actions */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLike}
              className={`transition-colors ${isLiked ? "text-red-500 hover:text-red-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShare} className="text-slate-400 hover:text-slate-600">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Publication Details Card */}
        <Card className="border-slate-200 rounded-2xl mb-8 overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-blue-50 p-6 border-b border-slate-200">
              <div className="flex items-center">
                <Info className="h-5 w-5 text-blue-600 mr-2" />
                <h2 className="text-xl font-semibold text-slate-900">Creative Information</h2>
              </div>
            </div>
            <div className="p-6">
              {/* Top Section - Main Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-500 mb-3">Page Name</h3>
                  <div className="flex items-center">
                    <p className="text-lg font-semibold text-slate-900">{ad.page_name}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-500 mb-3">Creative Format</h3>
                  <div className="flex items-center">
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
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-500 mb-3">Created Date</h3>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                    <p className="text-slate-900 font-medium">{formatDate(ad.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Bottom Section - Additional Details */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Additional Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-center mb-2">
                      <Hash className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-bold text-blue-600 break-all">{ad.ad_archive_id || "N/A"}</p>
                    <p className="text-sm font-medium text-slate-600 mt-1">Archive ID</p>
                  </div>

                  <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center justify-center mb-2">
                      <Type className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-emerald-600">{ad.cta_type || "N/A"}</p>
                    <p className="text-sm font-medium text-slate-600 mt-1">CTA Type</p>
                  </div>

                  <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="flex items-center justify-center mb-2">
                      <Video className="h-5 w-5 text-orange-600" />
                    </div>
                    <p className="text-sm font-bold text-orange-600">{ad.publisher_platform || "N/A"}</p>
                    <p className="text-sm font-medium text-slate-600 mt-1">Platform</p>
                  </div>

                  <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="flex items-center justify-center mb-2">
                      <Clock className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-sm font-bold text-purple-600">{activeDays} days</p>
                    <p className="text-sm font-medium text-slate-600 mt-1">Active Days</p>
                  </div>
                </div>
              </div>

              {/* Media Information */}
              {(ad.video_hd_url || ad.video_preview_image || ad.image_url) && (
                <div className="border-t border-slate-200 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Media Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ad.video_hd_url && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-slate-500 mb-2">Video URL</h4>
                        <div className="flex items-center">
                          <Link className="h-4 w-4 mr-2 text-slate-400" />
                          <p className="text-sm text-slate-700 truncate">Available</p>
                        </div>
                      </div>
                    )}
                    {ad.image_url && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-slate-500 mb-2">Image URL</h4>
                        <div className="flex items-center">
                          <Link className="h-4 w-4 mr-2 text-slate-400" />
                          <p className="text-sm text-slate-700 truncate">Available</p>
                        </div>
                      </div>
                    )}
                    {ad.meta_ad_url && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-slate-500 mb-2">Meta Ad URL</h4>
                        <div className="flex items-center">
                          <Link className="h-4 w-4 mr-2 text-slate-400" />
                          <a href={ad.meta_ad_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate">
                            {ad.meta_ad_url}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column - Creative preview and details */}
          <div>
            <Card className="overflow-hidden border-slate-200 rounded-2xl mb-6">
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

                  {/* Loading overlay */}
                  {(isVideo && !videoLoaded) || (!isVideo && !imageLoaded) ? (
                    <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
                      <div className="text-slate-400">Loading...</div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Video Controls */}
            {(isVideo || ad.image_url) && ( // Кнопка завантаження для відео або зображення
              <div className="flex gap-4 mb-6">
                {isVideo && (
                  <Button
                    onClick={handleRestartVideo}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restart Video
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isLoading || (!ad.video_hd_url && !ad.image_url)}
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 font-medium rounded-xl h-11 transition-all duration-200"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isLoading ? "Downloading..." : `Download ${isVideo ? "Video" : "Image"}`}
                </Button>
              </div>
            )}

            {/* Ad Text */}
            <Card className="border-slate-200 rounded-2xl mb-6">
              <CardContent className="p-0">
                <div className="bg-blue-50 p-6 border-b border-slate-200">
                  <h2 className="text-xl font-semibold text-slate-900">Ad Text</h2>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 leading-relaxed">{ad.text || "No ad text available"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Caption */}
            {ad.caption && (
              <Card className="border-slate-200 rounded-2xl mb-6">
                <CardContent className="p-0">
                  <div className="bg-blue-50 p-6 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">Caption</h2>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed">{ad.caption}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Link URL */}
            {ad.link_url && (
              <Card className="border-slate-200 rounded-2xl mb-6">
                <CardContent className="p-0">
                  <div className="bg-blue-50 p-6 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">Link URL</h2>
                  </div>
                  <div className="p-6">
                    <a
                      href={ad.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 break-all text-sm"
                    >
                      {ad.link_url}
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Call to Action */}
            {ad.cta_text && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-blue-50 p-6 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">Call to Action</h2>
                  </div>
                  <div className="p-6">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200">
                      {ad.cta_text}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Scripts */}
          <div className="space-y-6">
            {/* Text Script */}
            <Card className="border-slate-200 rounded-2xl">
              <CardContent className="p-0">
                <div className="bg-blue-50 p-6 border-b border-slate-200">
                  <h2 className="text-xl font-semibold text-slate-900">Text Script</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-800">
                      How to hit enough protein for weight loss and gain muscle?
                    </h3>

                    <div className="space-y-2">
                      <p className="font-medium text-slate-700">
                        High Protein Meal Plan for Busy Women on a Weight Loss Journey
                      </p>
                      <div className="text-slate-600 space-y-1">
                        <p>Day 1</p>
                        <p>Day 2</p>
                        <p>Day 3</p>
                        <p>Day 4</p>
                        <p>Day 5</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-slate-700">
                      <p>Don't wait!</p>
                      <p>BetterMe's Meal Plan</p>
                      <p>All require effort.</p>
                      <p>Make today count.</p>
                      <p>Tap BetterMe now.</p>
                      <p className="font-medium">Try now!</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audio Script */}
            {ad.audio_script && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-blue-50 p-6 border-b border-slate-200">
                    <div className="flex items-center">
                      <Mic className="h-5 w-5 text-blue-600 mr-2" />
                      <h2 className="text-xl font-semibold text-slate-900">Audio Script</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed">{ad.audio_script}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Video Scenario */}
            {ad.video_script && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-blue-50 p-6 border-b border-slate-200">
                    <div className="flex items-center">
                      <Film className="h-5 w-5 text-blue-600 mr-2" />
                      <h2 className="text-xl font-semibold text-slate-900">Video Scenario</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed">{ad.video_script}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Image Description */}
            {ad.image_description && (
              <Card className="border-slate-200 rounded-2xl">
                <CardContent className="p-0">
                  <div className="bg-blue-50 p-6 border-b border-slate-200">
                    <div className="flex items-center">
                      <ImageIcon className="h-5 w-5 text-blue-600 mr-2" />
                      <h2 className="text-xl font-semibold text-slate-900">Image Description</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed">{ad.image_description}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Share Modal */}
        {showShareModal && <ShareModal ad={ad} onClose={() => setShowShareModal(false)} />}
      </div>
    </div>
  )
})

export { AdDetails }
