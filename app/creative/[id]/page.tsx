import { createServerSupabaseClient } from '@/lib/core/supabase';
import { AdDetails } from './ad-details';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AdDetailsSkeleton } from './ad-details-skeleton';
import type { Metadata } from 'next';
import type { Ad, AdaptationScenario } from '@/lib/core/types';
import {
  parseScenarios,
  sanitizeScenarios,
  getVisualParagraphs,
  buildMetaAnalysis,
  buildGroupedSections,
  buildUnifiedAd,
} from './utils/adData';

async function getAdById(archiveId: string): Promise<Ad | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('ads')
    .select(
      `
      *,
      businesses ( slug )
    `
    )
    .eq('ad_archive_id', archiveId)
    .single();

  if (error || !data) return null;

  const business = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses;
  const slug = business?.slug;

  const ensureSlugInPath = (p: string | null) => {
    if (!p || !slug) return p;
    const cleanP = p.trim().replace(/^\/+/, ''); // Remove leading slashes
    if (cleanP.startsWith(`${slug}/`)) return cleanP; // Slug already present
    return `${slug}/${cleanP}`; // No slug, add it
  };

  return {
    ...data,
    id: data.ad_archive_id,
    realisation: data.realization,
    storage_path: ensureSlugInPath(data.storage_path),
    video_storage_path: ensureSlugInPath(data.video_storage_path),
  } as unknown as Ad;
}

/**
 * Related ads по группе (бизнес + векторная группа)
 */
async function getRelatedAdsByGroup(ad: Ad): Promise<Ad[] | null> {
  if (!ad.business_id || ad.vector_group === null) return null;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ads')
    .select('ad_archive_id, title, storage_path, display_format, page_name, created_at')
    .eq('business_id', ad.business_id)
    .eq('vector_group', ad.vector_group)
    .neq('ad_archive_id', ad.ad_archive_id)
    .limit(12);

  if (error) return null;
  return (data || []).map((a) => ({ ...a, id: a.ad_archive_id })) as Ad[];
}

/**
 * Метаданные (SEO)
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ad = await getAdById(params.id);
  if (!ad) return { title: 'Creative Not Found' };

  return {
    title: `${ad.title || 'Creative'} - ${ad.page_name} | TakeNap`,
    description: ad.text?.substring(0, 160) || ad.caption?.substring(0, 160),
  };
}

/**
 * Static params для ad_archive_id
 */
export async function generateStaticParams() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('ads').select('ad_archive_id').limit(20);
  return data?.map((ad) => ({ id: ad.ad_archive_id })) || [];
}

export default async function CreativePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { related?: string };
}) {
  // Load main creative (params.id is ad_archive_id)
  const ad = await getAdById(params.id);

  if (!ad) notFound();

  // Logic for getting related ads
  let relatedAds: Ad[] = [];
  if (searchParams.related) {
    const { data } = await createServerSupabaseClient()
      .from('ads')
      .select('ad_archive_id, title, storage_path, display_format')
      .in('ad_archive_id', searchParams.related.split(','));
    relatedAds = (data || []).map((a) => ({ ...a, id: a.ad_archive_id })) as Ad[];
  } else {
    const groupAds = await getRelatedAdsByGroup(ad);
    relatedAds = groupAds || [];
  }

  // Helper functions (utils) now work with clean object from schema
  const { visualMainParagraphs, visualDerivedFromVideo } = getVisualParagraphs(ad);
  const metaAnalysis = buildMetaAnalysis(ad, visualMainParagraphs);

  // cards_json is now passed directly from the ad object
  const adaptationScenarios = sanitizeScenarios(parseScenarios(ad));
  const groupedSections = buildGroupedSections(
    ad,
    metaAnalysis,
    adaptationScenarios as AdaptationScenario[]
  );
  const adUnified = buildUnifiedAd(ad);

  return (
    <Suspense fallback={<AdDetailsSkeleton />}>
      <AdDetails
        ad={adUnified}
        relatedAds={relatedAds}
        groupedSections={groupedSections}
        visualMainParagraphs={visualMainParagraphs}
        visualDerivedFromVideo={visualDerivedFromVideo}
        metaAnalysis={metaAnalysis}
      />
    </Suspense>
  );
}
