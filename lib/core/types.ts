export interface Ad {
  id: number;
  created_at: string;
  ad_archive_id: string;
  page_name: string;
  text: string;
  caption: string;
  cta_text: string;
  cta_type: string;
  display_format: string;
  link_url: string;
  title: string;
  video_hd_url: string | null;
  video_preview_image_url?: string | null; // Змінено з video_preview_image
  publisher_platform: string;
  // Нові поля з вашої таблиці
  audio_script: string | null;
  video_script: string | null;
  meta_ad_url: string | null;
  image_url?: string | null;
  image_description?: string | null;
  signed_image_url?: string | null;
  new_scenario?: string | null; // Додаємо нове поле для JSON сценаріїв
  tags?: string[] | null; // Додаємо поле для тегів

  // Дублікати та додаткові поля
  duplicates_ad_text?: string | null;
  duplicates_links?: string | null;
  duplicates_preview_image?: string | null;

  // Нові поля з таблиці ads_extended
  concept?: string | null;
  realisation?: string | null;
  topic?: string | null;
  hook?: string | null;
  character?: string | null;
}

export type ViewMode = 'grid' | 'list';

export interface FilterOptions {
  search: string;
  page: string | null;
  publisherPlatform?: string | null;
  date: string | null;
  tags: string[] | null; // Додаємо фільтр по тегам
  pageSize?: number | null;
}

// Типи для парсингу new_scenario JSON
export interface AdaptationScenario {
  persona_adapted_for: string;
  original_ad_id: string;
  ad_script_title: string;
  ad_script_full_text: string;
  technical_task_json: {
    visual_elements: string[];
    audio_style: string;
    call_to_action: string;
  };
}

// Competitor Analytics Types
export interface CompetitorAnalytics {
  totalCreatives: number;
  competitorBreakdown: CompetitorBreakdown[];
  averageVariationCount: number;
  funnelsUsed: number;
  themesUsed: number;
  mechanicsUsed: number;
  themeDistribution: DistributionItem[];
  hookDistribution?: DistributionItem[]; // optional hooks distribution
  funnelDistribution: DistributionItem[];
  mechanicDistribution: DistributionItem[];
  visualPatterns: VisualPattern[];
  formatDistribution: FormatDistribution;
  durationDistribution: DurationDistribution;
  characterDistribution: CharacterDistribution;
  trendsOverTime: TrendsData;
}

export interface CompetitorBreakdown {
  competitor: string;
  count: number;
  percentage: number;
}

export interface DistributionItem {
  name: string;
  count: number;
  percentage: number;
}

export interface VisualPattern {
  id: string;
  name: string;
  description: string;
  count: number;
  examples: string[];
}

export interface FormatDistribution {
  video: number;
  static: number;
  carousel: number;
  other: number;
}

export interface DurationDistribution {
  ranges: { range: string; count: number }[];
  mostCommon: string[];
}

export interface CharacterDistribution {
  types: { type: string; count: number }[];
  mostCommon: string;
}

export interface TrendsData {
  themesOverTime: TimeSeriesData[];
  funnelsOverTime: TimeSeriesData[];
  patternsOverTime: TimeSeriesData[];
  insights: {
    increasing: string[];
    decreasing: string[];
  };
}

export interface TimeSeriesData {
  date: string;
  series: { name: string; value: number }[];
}
