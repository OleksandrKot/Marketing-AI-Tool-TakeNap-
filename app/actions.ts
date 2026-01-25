'use server';

import { unstable_noStore as noStore } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/core/supabase';
import type { Ad, AdsGroup } from '@/lib/core/types';

/**
 * Получение групп объявлений с их представителями
 */
export async function getAdGroups(
  businessId?: string,
  limit = 100
): Promise<{ group: AdsGroup; representative: Ad }[]> {
  noStore(); // Disable caching for this function

  try {
    const supabase = createServerSupabaseClient();

    let groupQuery = supabase
      .from('ads_groups_test')
      .select('*')
      .order('last_ad_added_at', { ascending: false })
      .limit(limit);

    if (businessId) {
      groupQuery = groupQuery.eq('business_id', businessId);
    }

    const { data: groups, error: groupError } = await groupQuery;

    if (groupError || !groups || groups.length === 0) {
      if (groupError) console.error('❌ Error fetching groups:', groupError);
      return [];
    }

    const repIds = groups.map((g) => g.rep_ad_archive_id);

    // In the new schema, ad_archive_id is unique, so .in() will work correctly.
    // But for index optimization, it's better to add business_id if it exists.
    let adsQuery = supabase.from('ads').select('ad_archive_id').in('ad_archive_id', repIds);
    if (businessId) adsQuery = adsQuery.eq('business_id', businessId);

    const { data: reps, error: repsError } = await adsQuery;

    if (repsError) {
      console.error('❌ Error fetching representative ads:', repsError);
      return [];
    }

    // Return only group data (without full ad data)
    // Ads will be loaded on client
    return groups
      .map((group) => {
        const rep = (reps || []).find((r) => r.ad_archive_id === group.rep_ad_archive_id);
        if (!rep) return null;
        return {
          group: group as AdsGroup,
          representative: {
            id: rep.ad_archive_id,
            ad_archive_id: rep.ad_archive_id,
          } as Ad,
        };
      })
      .filter((item): item is { group: AdsGroup; representative: Ad } => item !== null);
  } catch (error) {
    console.error('❌ Error in getAdGroups:', error);
    return [];
  }
}

/**
 * Получение списка объявлений с фильтрацией
 */
export async function getAds(
  search?: string,
  page?: string | null,
  date?: string | null,
  tags?: string[] | null,
  publisherPlatform?: string | null,
  businessId?: string
): Promise<Ad[]> {
  noStore(); // Disable caching for large requests

  try {
    const supabase = createServerSupabaseClient();

    // Get group representative IDs
    let groupsQuery = supabase.from('ads_groups_test').select('rep_ad_archive_id');

    if (businessId) {
      groupsQuery = groupsQuery.eq('business_id', businessId);
    }

    const { data: groups, error: groupsError } = await groupsQuery;

    if (groupsError) {
      console.error('❌ Error fetching groups:', groupsError);
      return [];
    }

    const repIds = (groups || [])
      .map((g: Record<string, unknown>) => String(g.rep_ad_archive_id))
      .filter(Boolean);

    if (repIds.length === 0) {
      console.warn('⚠️ No representative ads found in groups');
      return [];
    }

    // Split IDs into chunks of 100 and load in parallel
    const chunkSize = 100;
    const chunks: string[][] = [];

    for (let i = 0; i < repIds.length; i += chunkSize) {
      chunks.push(repIds.slice(i, i + chunkSize) as string[]);
    }

    // Load all chunks in parallel
    const allPromises = chunks.map(async (chunk) => {
      let query = supabase
        .from('ads')
        .select(
          `
          business_id,
          ad_archive_id,
          page_name,
          publisher_platform,
          text,
          caption,
          cta_text,
          cta_type,
          display_format,
          link_url,
          title,
          storage_path,
          video_storage_path,
          vector_group,
          created_at
        `
        )
        .in('ad_archive_id', chunk)
        .order('created_at', { ascending: false });

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      if (search?.trim()) {
        const term = search.trim();
        query = query.or(
          `page_name.ilike.%${term}%,title.ilike.%${term}%,text.ilike.%${term}%,caption.ilike.%${term}%`
        );
      }

      if (page) query = query.eq('page_name', page);

      if (publisherPlatform?.trim()) {
        query = query.ilike('publisher_platform', `%${publisherPlatform.trim()}%`);
      }

      if (date) {
        const days = { '7days': 7, '30days': 30, '90days': 90 }[date] || 0;
        if (days > 0) {
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - days);
          query = query.gte('created_at', pastDate.toISOString());
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Supabase error:', error);
        return [];
      }

      return data || [];
    });

    const results = await Promise.all(allPromises);
    const allAds: Ad[] = results.flat();

    if (allAds.length === 0) {
      return [];
    }

    // Process media file paths
    const bucket = process.env.NEXT_PUBLIC_AD_BUCKET || 'creatives';

    return allAds.map((ad: Ad) => {
      // Define preview path (using new storage_path column)
      const displayFormat = ad.display_format || 'IMAGE';
      const pathValue = ad.video_storage_path || ad.storage_path || '';
      let pathToUse = displayFormat === 'VIDEO' ? pathValue : ad.storage_path || '';

      // If no path in main table, can keep conventional path logic
      if (!pathToUse) {
        pathToUse = `ads/${ad.ad_archive_id}/${ad.ad_archive_id}.jpeg`;
      }

      const proxyUrl = `/api/storage/proxy?bucket=${encodeURIComponent(
        bucket
      )}&path=${encodeURIComponent(String(pathToUse))}`;

      return {
        ...ad,
        signed_image_url: proxyUrl,
      } as Ad;
    });
  } catch (error) {
    console.error('❌ Error in getAds:', error);
    return [];
  }
}

/**
 * Получение уникальных имен страниц
 */
export async function getUniquePages(businessId?: string): Promise<string[]> {
  try {
    const supabase = createServerSupabaseClient();

    let query = supabase.from('ads').select('page_name').not('page_name', 'is', null);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query.order('page_name');

    if (error || !data) return [];

    return Array.from(new Set(data.map((item) => item.page_name)));
  } catch (error) {
    console.error('❌ Error in getUniquePages:', error);
    return [];
  }
}

/**
 * Получение всех объявлений группы
 */
export async function getRelatedAdsByGroup(businessId: string, vectorGroup: number): Promise<Ad[]> {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .eq('business_id', businessId)
      .eq('vector_group', vectorGroup)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((ad) => ({
      ...ad,
      id: ad.ad_archive_id,
      realisation: ad.realization,
    })) as Ad[];
  } catch (error) {
    console.error('❌ Error in getRelatedAdsByGroup:', error);
    return [];
  }
}

/**
 * Получение списка бизнесов
 */
export async function getBusinesses(): Promise<{ id: string; name: string; slug: string }[]> {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, slug')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Error fetching businesses:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error in getBusinesses:', error);
    return [];
  }
}
