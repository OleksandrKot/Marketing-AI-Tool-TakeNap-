// Ads Group - group representatives
export interface AdsGroup {
  business_id: string;
  vector_group: number;
  items: number;
  rep_ad_archive_id: string;
  rep_embedding?: number[];
  updated_at: string;
  last_processed_at: string | null;
  created_at: string;
  last_ad_added_at: string;
  previous_items_count: number;
  ai_description: string | null;
}

// Main ads table
export interface Ad {
  id?: number;
  created_at?: string;
  ad_archive_id: string;
  business_id?: string;
  vector_group?: number;
  page_name?: string;
  text?: string;
  caption?: string;
  cta_text?: string;
  cta_type?: string;
  display_format?: string;
  link_url?: string;
  title?: string;
  video_hd_url?: string | null;
  video_preview_image_url?: string | null;
  publisher_platform?: string;

  // JSON field for parsing
  raw_json?: Record<string, unknown>;

  // Additional fields
  audio_script?: string | null;
  video_script?: string | null;
  meta_ad_url?: string | null;
  image_url?: string | null;
  image_description?: string | null;
  signed_image_url?: string | null;
  new_scenario?: string | null;
  tags?: string[] | null;

  // Duplicates
  duplicates_ad_text?: string | null;
  duplicates_links?: string | null;
  duplicates_preview_image?: string | null;

  // Extended fields
  concept?: string | null;
  realisation?: string | null;
  topic?: string | null;
  hook?: string | null;
  character?: string | null;

  // Storage paths (format: business-slug/ad_archive_id.ext)
  storage_path?: string | null;
  video_storage_path?: string | null;
}

export type ViewMode = 'grid' | 'list';

export interface FilterOptions {
  search: string;
  page: string | null;
  publisherPlatform?: string | null;
  date: string | null;
  tags: string[] | null; // Adding filter by tags
  businessId?: string | null;
  pageSize?: number | null;
}

// Types for parsing new_scenario JSON
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
