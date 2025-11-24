import React from 'react';
import AdArchiveBrowser from './ad-archive-browser';
import { createServerSupabaseClient } from '@/lib/core/supabase';
import type { Ad } from '@/lib/core/types';
import { getUniquePages } from '@/app/actions';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams?: SearchParams }) {
  const pageParam = Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page;
  const pageSizeParam = Array.isArray(searchParams?.pageSize)
    ? searchParams?.pageSize[0]
    : searchParams?.pageSize;
  const search = Array.isArray(searchParams?.search)
    ? searchParams?.search[0]
    : searchParams?.search;
  const pageName = Array.isArray(searchParams?.page_name)
    ? searchParams?.page_name[0]
    : searchParams?.page_name;

  const page = Math.max(1, parseInt(pageParam as string, 10) || 1);
  const pageSize = Math.max(1, parseInt(pageSizeParam as string, 10) || 12);
  const offset = (page - 1) * pageSize;

  const supabase = createServerSupabaseClient();

  const selectCols = `
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
    video_preview_image_url,
    publisher_platform,
    audio_script,
    video_script,
    meta_ad_url,
    image_url,
    image_description,
    new_scenario,
    tags,
    concept,
    realisation,
    topic,
    hook,
    character
  `;

  try {
    let query = supabase
      .from('ads_library')
      .select(selectCols, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query = query.or(
        `page_name.ilike.%${term}%,title.ilike.%${term}%,text.ilike.%${term}%,caption.ilike.%${term}%`
      );
    }

    if (pageName && String(pageName).trim()) {
      query = query.eq('page_name', String(pageName).trim());
    }

    // Apply range for pagination
    const rangeStart = offset;
    const rangeEnd = offset + pageSize - 1;

    const { data, count, error } = await query.range(rangeStart, rangeEnd);

    if (error) {
      console.error('Supabase error during paginated fetch:', error);
      return (
        <AdArchiveBrowser
          initialAds={[]}
          pages={await getUniquePages()}
          initialFilters={{ search: search || '', page: null, date: null, tags: null, pageSize }}
        />
      );
    }

    const rows = (data as Ad[]) || [];
    const initialTotal = typeof count === 'number' ? count : rows.length;

    // Generate signed URLs only for items on the current page
    const signedPromises = rows.map(async (ad) => {
      try {
        if (!ad || !ad.ad_archive_id) return ad;
        const bucket = ad.display_format === 'VIDEO' ? 'test10public_preview' : 'test9bucket_photo';
        const path = `${ad.ad_archive_id}.jpeg`;
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600);
        if (!signedError && signedData?.signedUrl) {
          return { ...ad, signed_image_url: signedData.signedUrl } as Ad & {
            signed_image_url?: string;
          };
        }
      } catch (e) {
        console.debug('Failed to sign image for ad', ad?.id, e);
      }
      return ad;
    });

    const adsWithSigned = await Promise.all(signedPromises);

    const pages = await getUniquePages();

    // initialFilters uses strings/null to match hook expectations
    const initialFilters = {
      search: search || '',
      page: String(page),
      date: null,
      tags: null,
      pageSize,
    };

    return (
      <AdArchiveBrowser
        initialAds={adsWithSigned}
        pages={pages}
        initialFilters={initialFilters}
        initialTotalAds={initialTotal}
      />
    );
  } catch (err) {
    console.error('Error in ad-archive page:', err);
    const pages = await getUniquePages();
    return (
      <AdArchiveBrowser
        initialAds={[]}
        pages={pages}
        initialFilters={{ search: '', page: null, date: null, tags: null, pageSize }}
        initialTotalAds={0}
      />
    );
  }
}
