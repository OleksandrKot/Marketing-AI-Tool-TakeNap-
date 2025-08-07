import { createServerSupabaseClient } from "@/lib/supabase"
import { AdDetails } from "./ad-details"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { AdDetailsSkeleton } from "./ad-details-skeleton"
import type { Metadata } from "next"

// Кешування даних креативу
async function getAdById(id: string) {
  const supabase = createServerSupabaseClient()

  // Оптимізований запит - вибираємо тільки потрібні поля
  const { data, error } = await supabase
    .from("ads_library")
    .select(`
      id,
      created_at,
      ad_archive_id,
      page_name,
      text,
      caption,
      cta_text,
      cta_type,
      display_format,
      link_url,
      title,
      video_hd_url,
      video_preview_image,
      publisher_platform,
      audio_script,
      video_script,
      meta_ad_url,
      image_url,
      image_description
    `)
    .eq("id", id)
    .single()

  if (error || !data) {
    console.error("Error fetching ad:", error)
    return null
  }

  return data
}

// Генерація метаданих для SEO та соціальних мереж
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ad = await getAdById(params.id)

  if (!ad) {
    return {
      title: "Creative Not Found",
      description: "The requested creative could not be found.",
    }
  }

  return {
    title: `${ad.title || "Creative"} - ${ad.page_name} | TakeNap`,
    description: ad.text ? ad.text.substring(0, 160) : `Creative from ${ad.page_name}`,
    openGraph: {
      title: ad.title || "Creative",
      description: ad.text?.substring(0, 160),
      images: ad.video_preview_image ? [ad.video_preview_image] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: ad.title || "Creative",
      description: ad.text?.substring(0, 160),
      images: ad.video_preview_image ? [ad.video_preview_image] : [],
    },
  }
}

// Статична генерація для популярних креативів (опціонально)
export async function generateStaticParams() {
  const supabase = createServerSupabaseClient()

  // Генеруємо статичні сторінки для топ-100 креативів
  const { data } = await supabase.from("ads_library").select("id").order("created_at", { ascending: false }).limit(100)

  return (
    data?.map((ad) => ({
      id: ad.id.toString(),
    })) || []
  )
}

interface CreativePageProps {
  params: {
    id: string
  }
}

export default async function CreativePage({ params }: CreativePageProps) {
  const ad = await getAdById(params.id)

  if (!ad) {
    notFound()
  }

  return (
    <Suspense fallback={<AdDetailsSkeleton />}>
      <AdDetails ad={ad} />
    </Suspense>
  )
}
