export interface Ad {
  id: number
  created_at: string
  ad_archive_id: string
  page_name: string
  text: string
  caption: string
  cta_text: string
  cta_type: string
  display_format: string
  link_url: string
  title: string
  video_hd_url: string
  video_preview_image: string
  publisher_platform: string
}

export type ViewMode = "grid" | "list"

export interface FilterOptions {
  search: string
  page: string | null
  date: string | null
}
