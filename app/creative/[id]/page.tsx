import { createServerSupabaseClient } from '@/lib/core/supabase';
import { AdDetails } from './ad-details';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AdDetailsSkeleton } from './ad-details-skeleton';
import type { Metadata } from 'next';
import type { Ad } from '@/lib/core/types';

export const dynamic = 'force-dynamic';

/**
 * Fetch group description from ads_groups_test table
 */
async function getGroupDescription(
  business_id: string | undefined,
  vector_group: number | null | undefined
): Promise<string | null> {
  if (!business_id || vector_group === null || vector_group === undefined) return null;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ads_groups_test')
    .select('ai_description')
    .eq('business_id', business_id)
    .eq('vector_group', vector_group)
    .single();

  if (error || !data) return null;
  return data.ai_description || null;
}

async function getAdById(archiveId: string): Promise<Ad | null> {
  const supabase = createServerSupabaseClient();
  console.log(`[Creative Detail] Fetching ad with archive ID: ${archiveId}`);

  const { data, error } = await supabase
    .from('ads')
    .select(
      `
      *,
      businesses ( slug )
    `,
      { count: 'exact' }
    )
    .eq('ad_archive_id', archiveId)
    .single();

  if (error) {
    console.error(`[Creative Detail] Error fetching ad ${archiveId}:`, error);
    return null;
  }

  if (!data) {
    console.warn(`[Creative Detail] No ad found for archive ID: ${archiveId}`);
    return null;
  }

  console.log(`[Creative Detail] Raw raw_json from DB:`, {
    raw_json_type: typeof data.raw_json,
    raw_json_sample:
      typeof data.raw_json === 'string'
        ? data.raw_json.substring(0, 200)
        : Object.keys(data.raw_json || {}),
  });

  console.log(`[Creative Detail] Ad fetched successfully. Keys available:`, Object.keys(data));

  const business = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses;
  const slug = business?.slug;

  const ensureSlugInPath = (p: string | null) => {
    if (!p || !slug) return p;
    const cleanP = p.trim().replace(/^\/+/, ''); // Remove leading slashes
    if (cleanP.startsWith(`${slug}/`)) return cleanP; // Slug already present
    return `${slug}/${cleanP}`; // No slug, add it
  };

  // Fetch group description
  const groupDescription = await getGroupDescription(data.business_id, data.vector_group);
  console.log(`[Creative Detail] Group description:`, groupDescription);

  // Debug missing concept fields
  console.log(`[Creative Detail] Field values:`, {
    concept: data.concept,
    title: data.title,
    text: data.text,
    caption: data.caption,
    realisation: data.realization,
    display_format: data.display_format,
    vector_group: data.vector_group,
    business_id: data.business_id,
  });

  return {
    ...data,
    id: data.ad_archive_id,
    realisation: data.realization,
    storage_path: ensureSlugInPath(data.storage_path),
    video_storage_path: ensureSlugInPath(data.video_storage_path),
    group_description: groupDescription,
  } as unknown as Ad;
}

/**
 * Related ads by group (business + vector group)
 */
async function getRelatedAdsByGroup(ad: Ad): Promise<Ad[] | null> {
  if (!ad.business_id || ad.vector_group === null) {
    console.log(
      `[Creative Detail] Skipping related ads - missing business_id (${ad.business_id}) or vector_group (${ad.vector_group})`
    );
    return null;
  }

  console.log(
    `[Creative Detail] Fetching related ads for vector_group: ${ad.vector_group}, business_id: ${ad.business_id}`
  );
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ads')
    .select(
      'ad_archive_id, title, storage_path, video_storage_path, display_format, page_name, created_at, businesses ( slug )'
    )
    .eq('business_id', ad.business_id)
    .eq('vector_group', ad.vector_group)
    .neq('ad_archive_id', ad.ad_archive_id)
    .limit(25);

  if (error) {
    console.error(`[Creative Detail] Error fetching related ads:`, error);
    return null;
  }

  console.log(`[Creative Detail] Found ${data?.length || 0} related ads for this group`);

  return (data || []).map((a) => {
    const business = Array.isArray(a.businesses) ? a.businesses[0] : a.businesses;
    const slug = business?.slug;

    const ensureSlugInPath = (p: string | null) => {
      if (!p || !slug) return p;
      const cleanP = p.trim().replace(/^\/+/, '');
      if (cleanP.startsWith(`${slug}/`)) return cleanP;
      return `${slug}/${cleanP}`;
    };

    return {
      ...a,
      id: a.ad_archive_id,
      storage_path: ensureSlugInPath(a.storage_path),
      video_storage_path: ensureSlugInPath(a.video_storage_path),
    };
  }) as Ad[];
}

/**
 * Metadata (SEO)
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
 * Static params for ad_archive_id
 */
export async function generateStaticParams() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('ads').select('ad_archive_id').limit(20);
  return data?.map((ad) => ({ id: ad.ad_archive_id })) || [];
}

function AdDetailsContent({ ad, relatedAds }: { ad: Ad; relatedAds: Ad[] | null }) {
  // Don't process here - move to client component
  // Let AdDetails handle all the heavy lifting with client-side processing
  return <AdDetails ad={ad} relatedAds={relatedAds} />;
}

export default async function CreativePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { related?: string };
}) {
  console.log(`[Creative Page] Loading creative detail page for ID: ${params.id}`);

  // Load main ad first (required)
  const ad = await getAdById(params.id);

  if (!ad) {
    console.error(`[Creative Page] Ad not found for ID: ${params.id}`);
    notFound();
  }

  console.log(`[Creative Page] Ad loaded successfully`);

  // Load related ads (don't block main content)
  let relatedAds: Ad[] | null = null;
  try {
    console.log(`[Creative Page] Attempting to load related ads...`);
    if (searchParams.related) {
      console.log(`[Creative Page] Loading from search params: ${searchParams.related}`);
      const result = await createServerSupabaseClient()
        .from('ads')
        .select(
          'ad_archive_id, title, storage_path, video_storage_path, display_format, businesses ( slug )'
        )
        .in('ad_archive_id', searchParams.related.split(','));

      relatedAds = (result.data || []).map((a) => {
        const business = Array.isArray(a.businesses) ? a.businesses[0] : a.businesses;
        const slug = business?.slug;

        const ensureSlugInPath = (p: string | null) => {
          if (!p || !slug) return p;
          const cleanP = p.trim().replace(/^\/+/, '');
          if (cleanP.startsWith(`${slug}/`)) return cleanP;
          return `${slug}/${cleanP}`;
        };

        return {
          ...a,
          id: a.ad_archive_id,
          storage_path: ensureSlugInPath(a.storage_path),
          video_storage_path: ensureSlugInPath(a.video_storage_path),
        };
      }) as Ad[];
      console.log(
        `[Creative Page] Loaded ${relatedAds?.length || 0} related ads from search params`
      );
    } else {
      relatedAds = await getRelatedAdsByGroup(ad);
      console.log(`[Creative Page] Loaded ${relatedAds?.length || 0} related ads from group`);
    }
  } catch (error) {
    console.error('[Creative Page] Failed to load related ads:', error);
    relatedAds = null;
  }

  console.log(`[Creative Page] Page rendering complete. Ad fields summary:`, {
    hasTitle: !!ad.title,
    hasConcept: !!ad.concept,
    hasText: !!ad.text,
    hasCaption: !!ad.caption,
    relatedAdsCount: relatedAds?.length || 0,
  });

  return (
    <Suspense fallback={<AdDetailsSkeleton />}>
      <AdDetailsContent ad={ad} relatedAds={relatedAds} />
    </Suspense>
  );
}
