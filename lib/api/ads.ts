// import type { Ad } from '@/lib/core/types';
// import { fetchJSON } from '@/lib/api/client';

import type { Ad } from '@/lib/core/types';

export type FetchAdsParams = {
  businessId?: string;
  pageNames?: string[];
  displayFormats?: string[];
  ctaTypes?: string[];
  concepts?: string[];
  realizations?: string[];
  topics?: string[];
  hooks?: string[];
  characters?: string[];
  platforms?: string[];
  search?: string;
  funnels?: string[];
  variationCounts?: string[];
  dateRanges?: string[];
  representativesOnly?: boolean;
};

export type Facets = {
  pageNames: string[];
  publisherPlatforms: string[];
  displayFormats: string[];
  ctaTypes: string[];
  conceptFormats: string[];
  realizationFormats: string[];
  topicFormats: string[];
  hookFormats: string[];
  characterFormats: string[];
  funnels: string[];
  counts: Record<string, Record<string, number>>;
  businesses: Array<{ id: string; name: string; slug: string }>;
  variationBuckets: string[];
  dateRangeOptions: string[];
};

// AdsPage type as used in FilteredContainer
export type AdsPage = {
  data: Ad[];
  hasMore: boolean;
  limit: number;
  offset: number;
  groupSizes?: Record<string, number>;
  groupAdsMap?: Record<string, string[]>;
  groupAdsDetailsMap?: Record<string, Ad[]>;
};

const buildQuery = (
  params: Record<string, string | number | boolean | string[] | undefined | null>
) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item !== undefined && item !== null && String(item).length) {
          search.append(k, String(item));
        }
      });
      return;
    }
    search.set(k, String(v));
  });
  return search.toString();
};

export async function fetchFacets(params: FetchAdsParams): Promise<Facets> {
  const q: Record<string, string | number | boolean | string[] | undefined | null> = { ...params };
  // ensure representativesOnly true
  q.representativesOnly = true;
  const qs = buildQuery(q);
  const res = await fetch(`/api/ads/facets?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch facets');
  const json = await res.json();
  return json.data as Facets;
}

export async function fetchAds(
  params: FetchAdsParams & { limit: number; offset: number }
): Promise<AdsPage> {
  const q: Record<string, string | number | boolean | string[] | undefined | null> = { ...params };
  q.representativesOnly = true;
  const qs = buildQuery(q);
  const res = await fetch(`/api/ads?${qs}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`fetchAds failed: ${txt}`);
  }
  const json = await res.json();
  return json as AdsPage;
}
