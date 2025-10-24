"use client"

import { Calendar, Video, Tag } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useState } from "react"
import type { Ad } from "@/lib/types"
import { formatDate, truncateText } from "@/lib/utils"

interface AdCardProps {
  ad: Ad
  relatedAds?: Ad[]
}

export function AdCard({ ad, relatedAds = [] }: AdCardProps) {
  const router = useRouter()
  const [imageLoaded, setImageLoaded] = useState(false)
  const title = ad.title || "Untitled Ad"
  const isVideo = ad.display_format === "VIDEO"

  // Calculate active days (mock calculation for demo)
  const createdDate = new Date(ad.created_at)
  const today = new Date()
  const activeDays = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

  const handleViewDetails = () => {
    // Переходимо на реальну сторінку деталей з ID креативу та передаємо relatedAds через URL
    const relatedAdsIds = relatedAds.map(relatedAd => relatedAd.id).join(',')
    const url = relatedAdsIds ? `/creative/${ad.id}?related=${relatedAdsIds}` : `/creative/${ad.id}`
    router.push(url)
  }

  // Prefetch the details page on hover for faster navigation
  const handleMouseEnter = () => {
    router.prefetch(`/creative/${ad.id}`)
  }

  // Логіка для preview картинки:
  // - Для відео: використовуємо video_preview_image_url або image_url як fallback
  // - Для статичних: використовуємо image_url (сам креатив)
  const previewImage = isVideo
    ? ad.video_preview_image_url || ad.image_url || "/placeholder.svg"
    : ad.image_url || "/placeholder.svg"

  // Безпечна перевірка тегів
  const tags = Array.isArray(ad.tags) ? ad.tags : []

  return (
    <Card
      className="group overflow-hidden bg-white border border-slate-200 rounded-2xl h-full flex flex-col hover:border-blue-200 hover:shadow-lg transition-all duration-300 ease-out"
      onMouseEnter={handleMouseEnter}
    >
      <CardHeader className="p-6 pb-4 flex flex-row items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 truncate text-lg leading-tight mb-1">{truncateText(title, 35)}</h3>
          <p className="text-sm text-slate-500 font-medium">{ad.page_name}</p>
        </div>
        {isVideo && (
          <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-medium px-3 py-1 rounded-full border">
            📹 Video
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-6 pt-0 flex-grow">
        <div className="relative aspect-video mb-3 bg-slate-100 rounded-xl overflow-hidden group-hover:shadow-md transition-shadow duration-300">
          {previewImage && previewImage !== "/placeholder.svg" ? (
            <div className="relative w-full h-full">
              <Image
                src={previewImage || "/placeholder.svg"}
                alt={title}
                fill
                className="object-cover transition-all duration-300 group-hover:scale-105"
                style={{ opacity: imageLoaded ? 1 : 0 }}
                onLoad={() => setImageLoaded(true)}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                loading="lazy"
              />
              {!imageLoaded && <div className="absolute inset-0 bg-slate-200 animate-pulse" />}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Video className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm">No preview</p>
              </div>
            </div>
          )}

          {/* Overlay gradient for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <p className="text-sm text-slate-600 line-clamp-3 mb-3 leading-relaxed">{truncateText(ad.text || "", 120)}</p>

        {/* Tags Display - безпечна перевірка */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                className="bg-purple-50 text-purple-700 border-purple-200 font-medium px-2 py-1 rounded-full border text-xs"
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium px-2 py-1 rounded-full border text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mt-3">
          <div className="flex items-center">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            <span>{formatDate(ad.created_at)}</span>
          </div>
          <div className="flex items-center">
            <span className="text-orange-600 font-medium">Active: {activeDays} days</span>
            <div className="w-2 h-2 bg-green-500 rounded-full ml-2"></div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0">
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25"
          onClick={handleViewDetails}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  )
}
