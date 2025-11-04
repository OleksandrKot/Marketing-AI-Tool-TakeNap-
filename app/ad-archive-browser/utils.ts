import type { Ad } from "@/lib/types"

export const getImageKey = (imageUrl: string): string => {
  try {
    const url = new URL(imageUrl)
    const parts = url.pathname.split("/")
    const basePath = parts.slice(0, -1).join("/")
    return `${url.hostname}${basePath}`
  } catch {
    return imageUrl.split("?")[0].split("/").slice(0, -1).join("/")
  }
}

export const getGroupingKey = (ad: Ad): string => {
  const imageKey = ad.image_url ? getImageKey(ad.image_url) : "no-image"
  const textKey = ad.text ? ad.text.substring(0, 100).replace(/\s+/g, " ").trim() : "no-text"
  return `${imageKey}|${textKey}`
}

export const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

export const uniqueTags = (ads: Ad[]): string[] =>
  Array.from(
    new Set(ads.filter((ad) => Array.isArray(ad.tags) && ad.tags.length > 0).flatMap((ad) => ad.tags || [])),
  ).sort()
