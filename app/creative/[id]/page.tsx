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

  // Fetch group description
  const groupDescription = await getGroupDescription(data.business_id, data.vector_group);

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
  if (!ad.business_id || ad.vector_group === null) return null;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ads')
    .select(
      'ad_archive_id, title, storage_path, video_storage_path, display_format, page_name, created_at, businesses ( slug )'
    )
    .eq('business_id', ad.business_id)
    .eq('vector_group', ad.vector_group)
    .neq('ad_archive_id', ad.ad_archive_id)
    .limit(12);

  if (error) return null;

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
  // Load main ad first (required)
  const ad = await getAdById(params.id);

  if (!ad) notFound();

  // Load related ads (don't block main content)
  let relatedAds: Ad[] | null = null;
  try {
    if (searchParams.related) {
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
    } else {
      relatedAds = await getRelatedAdsByGroup(ad);
    }
  } catch (error) {
    console.error('Failed to load related ads:', error);
    relatedAds = null;
  }

  return (
    <Suspense fallback={<AdDetailsSkeleton />}>
      <AdDetailsContent ad={ad} relatedAds={relatedAds} />
    </Suspense>
  );
}
