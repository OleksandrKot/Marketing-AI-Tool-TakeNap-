"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import type { Ad } from "@/lib/types"

export async function getAds(search?: string, page?: string | null, date?: string | null, limit = 100): Promise<Ad[]> {
  const supabase = createServerSupabaseClient()

  // Оновлено: вибираємо всі нові поля
  let query = supabase.from("ads_library").select(`
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
  `).order("created_at", { ascending: false }).limit(limit)

  if (search) {
    query = query.or(`title.ilike.%${search}%,text.ilike.%${search}%,page_name.ilike.%${search}%`)
  }

  if (page) {
    query = query.eq("page_name", page)
  }

  if (date) {
    const now = new Date()
    let daysAgo

    switch (date) {
      case "7days":
        daysAgo = 7
        break
      case "30days":
        daysAgo = 30
        break
      case "90days":
        daysAgo = 90
        break
      default:
        daysAgo = 0
    }

    if (daysAgo > 0) {
      const pastDate = new Date(now)
      pastDate.setDate(now.getDate() - daysAgo)
      query = query.gte("created_at", pastDate.toISOString())
    }
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching ads:", error)
    return []
  }

  return data as Ad[]
}

export async function getUniquePages(): Promise<string[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("ads_library")
    .select("page_name")
    .order("page_name")
    .not("page_name", "is", null)

  if (error) {
    console.error("Error fetching pages:", error)
    return []
  }

  // Extract unique page names
  const uniquePages = [...new Set(data.map((item) => item.page_name))]
  return uniquePages
}
