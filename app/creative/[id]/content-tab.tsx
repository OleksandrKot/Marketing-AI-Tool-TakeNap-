"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Video, Download, RotateCcw, ExternalLink, Copy, Check, Mic, Film, Eye } from "lucide-react"
import ScriptRenderer from "@/components/script-renderer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Ad } from "@/lib/types"

interface ContentTabProps {
  ad: Ad
  relatedAds?: Ad[] | null
}

export function ContentTab({ ad, relatedAds }: ContentTabProps) {
  const router = useRouter()
  const leftColRef = useRef<HTMLDivElement | null>(null)
  const [leftHeight, setLeftHeight] = useState<number | null>(null)
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

  // use shared ScriptRenderer component

  // Логіка для preview картинки:
  // - Для відео: використовуємо video_preview_image_url або image_url як fallback
  // - Для статичних: використовуємо image_url (сам креатив)
  const previewImage = isVideo
    ? ad.video_preview_image_url || ad.image_url || "/placeholder.svg"
    : ad.image_url || "/placeholder.svg"

  const imageArray = ad.duplicates_preview_image?.split(";").filter(url => url.trim() !== "") || [];
  
  // Debug: логуємо duplicates_preview_image для перевірки
  console.log("duplicates_preview_image:", ad.duplicates_preview_image);
  console.log("imageArray:", imageArray);
  
  useEffect(() => {
    const measure = () => {
      const h = leftColRef.current?.offsetHeight ?? null
      setLeftHeight(h)
    }

    measure()
    let t: any = null
    const onResize = () => {
      clearTimeout(t)
      t = setTimeout(measure, 120)
    }
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      clearTimeout(t)
    }
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Media & Content */}
      <div ref={leftColRef} className="lg:col-span-2 space-y-6">
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
        {ad.duplicates_preview_image && imageArray.length > 0 && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-blue-50 p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">Other Duplicates</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {imageArray.map((url, index) => {
                  const cleanUrl = url.trim();
                  return (
                    <div key={index} className="space-y-2">
                      <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden">
                        {cleanUrl ? (
                          <img
                            src={cleanUrl}
                            alt={`Duplicate ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Якщо зображення не завантажилось, показуємо placeholder
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                              target.parentElement!.innerHTML = `
                                <div class="text-center">
                                  <div class="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <svg class="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                  </div>
                                  <p class="text-xs text-slate-400">No preview</p>
                                </div>
                              `;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2">
                                <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                              </div>
                              <p className="text-xs text-slate-400">No preview</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-2">Duplicate {index + 1}</p>
                    </div>
                  );
                })}
                </div>
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

        {/* Related Ads Section */}
        {relatedAds && relatedAds.length > 0 && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-0">
              <div className="bg-blue-50 p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">Related Ads ({relatedAds.length})</h2>
              </div>
              <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {relatedAds.map((relatedAd) => (
                  <div
                    key={relatedAd.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      // Передаємо всі related ads (включаючи поточний ad) на нову сторінку
                      const allRelatedIds = [ad.id, ...relatedAds.map(ra => ra.id)].filter(id => id !== relatedAd.id)
                      const relatedParam = allRelatedIds.length > 0 ? `?related=${allRelatedIds.join(',')}` : ''
                      router.push(`/creative/${relatedAd.id}${relatedParam}`)
                    }}
                  >
                    <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden mb-3">
                      {relatedAd.image_url && (
                        <img
                          src={relatedAd.image_url}
                          alt={relatedAd.title || "Related ad"}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <h3 className="font-medium text-slate-900 mb-1 line-clamp-2">
                      {relatedAd.title || "Untitled Ad"}
                    </h3>
                    <p className="text-sm text-slate-500 mb-2">{relatedAd.page_name}</p>
                    {relatedAd.display_format === "VIDEO" && (
                      <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                        📹 Video
                      </span>
                    )}
                  </div>
                ))}
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
          <Card
            className="border-slate-200 rounded-2xl"
            style={leftHeight ? { height: `${leftHeight}px` } : undefined}
          >
            <CardContent className="p-0 flex flex-col h-full">
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
              <div className="p-6 overflow-y-auto">
                <ScriptRenderer script={ad.video_script} copyPrefix="video_script" />
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
