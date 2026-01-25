import { createServerSupabaseClient } from '@/lib/core/supabase';
import { ViewDetails } from './view-details';
import type { Ad } from '@/lib/core/types';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ViewDetailsSkeleton } from './view-details-skeleton';
import type { Metadata } from 'next';

// Getting creative by ad_archive_id
async function getAdById(id: string) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('ads')
    .select(
      `
      ad_archive_id,
      created_at,
      page_name,
      text,
      caption,
      cta_text,
      cta_type,
      display_format,
      link_url,
      title,
      video_hd_url,
      video_preview_image_url,
      concept,
      realization,
      topic,
      hook,
      character,
      publisher_platform,
      audio_script,
      video_script,
      meta_ad_url,
      image_url,
      image_description,
      duplicates_ad_text,
      duplicates_links,
      duplicates_preview_image,
      raw_json
    `
    )
    .eq('ad_archive_id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching ad:', error);
    return null;
  }

  return data as Ad;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ad = await getAdById(params.id);

  if (!ad) {
    return {
      title: 'Creative Not Found',
      description: 'The requested creative could not be found.',
    };
  }

  return {
    title: `${ad.title || 'Creative'} - ${ad.page_name} | TakeNap`,
    description: ad.text
      ? ad.text.substring(0, 160)
      : ad.title
      ? ad.title.substring(0, 160)
      : `Creative from ${ad.page_name}`,
    openGraph: {
      title: ad.title || 'Creative',
      description:
        ad.text?.substring(0, 160) ||
        ad.title?.substring(0, 160) ||
        `Creative from ${ad.page_name}`,
      images: ad.video_preview_image_url ? [ad.video_preview_image_url] : [],
    },
  };
}

interface ViewDetailsPageProps {
  params: {
    id: string;
  };
}

export default async function ViewDetailsPage({ params }: ViewDetailsPageProps) {
  const ad = await getAdById(params.id);

  if (!ad) {
    notFound();
  }

  return (
    <Suspense fallback={<ViewDetailsSkeleton />}>
      <ViewDetails ad={ad as Ad} />
    </Suspense>
  );
}
