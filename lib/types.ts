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
  video_preview_image_url: string // Змінено з video_preview_image
  publisher_platform: string
  // Нові поля з вашої таблиці
  audio_script: string | null
  video_script: string | null
  meta_ad_url: string | null
  image_url: string | null
  image_description: string | null
  new_scenario: string | null // Додаємо нове поле для JSON сценаріїв
  tags: string[] | null // Додаємо поле для тегів
}

export type ViewMode = "grid" | "list"

export interface FilterOptions {
  search: string
  page: string | null
  date: string | null
  tags: string[] | null // Додаємо фільтр по тегам
}

// Типи для парсингу new_scenario JSON
export interface AdaptationScenario {
  persona_adapted_for: string
  original_ad_id: string
  ad_script_title: string
  ad_script_full_text: string
  technical_task_json: {
    visual_elements: string[]
    audio_style: string
    call_to_action: string
  }
}
