"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import { Video, Download, RotateCcw, ExternalLink, Copy, Check, Mic, Film, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Ad } from "@/lib/types"

interface ContentTabProps {
  ad: Ad
}

export function ContentTab({ ad }: ContentTabProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const isVideo = ad.display_format === "VIDEO"

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

  // Логіка для preview картинки:
  // - Для відео: використовуємо video_preview_image_url або image_url як fallback
  // - Для статичних: використовуємо image_url (сам креатив)
  const previewImage = isVideo
    ? ad.video_preview_image_url || ad.image_url || "/placeholder.svg"
    : ad.image_url || "/placeholder.svg"

  const imageArray = ad.duplicates_preview_image?.split(";") || [];
  
  return (
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
                  poster={previewImage !== "/placeholder.svg" ? previewImage : undefined}
                  controls
                  preload="metadata"
                  className="w-full h-full object-contain"
                  onLoadedData={() => setVideoLoaded(true)}
                  style={{ display: videoLoaded ? "block" : "none" }}
                />
              ) : previewImage && previewImage !== "/placeholder.svg" ? (
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

        {/* Other duplicates gallery */}
        {ad.duplicates_preview_image && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Other Duplicates</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {imageArray.map((url, index) => (
                  <div key={index} className="space-y-2">
                    <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden">
                      <img
                        src={url.trim()}
                        alt={`image-${index}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2">Duplicate {index + 1}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

      {/* Right Column - Links & Scripts */}
      <div className="space-y-6">
        {/* Audio Script */}
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

        {/* Video Script */}
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

        {/* Image Description */}
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
                    {copiedField === "image_description" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
  )
}
