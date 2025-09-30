import { createServerSupabaseClient } from "@/lib/supabase"
import { AdDetails } from "../creative/[id]/ad-details"

// Отримуємо перший доступний креатив з бази даних
async function getFirstAd() {
  const supabase = createServerSupabaseClient()

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
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    console.error("Error fetching ad:", error)
    return null
  }

  return data
}

export default async function TestCreativeDetailsPage() {
  const ad = await getFirstAd()

  if (!ad) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">No ads found</h1>
          <p className="text-slate-600">Please add some ads to your database first.</p>
        </div>
      </div>
    )
  }

  return <AdDetails ad={ad} />
}
