'use server';

import { unstable_noStore as noStore } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/core/supabase';
import type { Ad, AdsGroup } from '@/lib/core/types';

// Helper to fetch all records from Supabase (handles 1000 record limit)
const fetchAllRecords = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterFn?: (query: any) => any
) => {
  const pageSize = 1000;
  let offset = 0;
  const allRecords: Array<Record<string, unknown>> = [];

  while (true) {
    let query = supabase
      .from(table)
      .select(select)
      .range(offset, offset + pageSize - 1);

    if (filterFn) {
      query = filterFn(query);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;
    allRecords.push(...data);

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allRecords;
};

/**
 * Get ad groups with their representatives
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
 * Get list of ads with filtering
 */
export async function getAds(
  search?: string,
  page?: string | null,
  date?: string | null,
  tags?: string[] | null,
  publisherPlatform?: string | null,
  businessId?: string,
  ungrouped?: boolean, // New parameter to get all ads without grouping
  offset?: number, // Pagination offset
  limit?: number // Pagination limit
): Promise<Ad[]> {
  noStore(); // Disable caching for large requests

  try {
    const supabase = createServerSupabaseClient();

    console.log('[getAds] request', {
      search,
      page,
      date,
      publisherPlatform,
      businessId,
      ungrouped,
      offset,
      limit,
    });

    // If ungrouped is true, fetch ads with pagination
    if (ungrouped) {
      const pageOffset = offset || 0;
      const pageLimit = limit || 1000;

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
          created_at,
          start_date_formatted,
          end_date_formatted,
          concept,
          realization,
          topic,
          hook,
          character,
          duplicates_count,
          video_script,
          audio_script,
          raw_json,
          url
        `
        )
        .order('start_date_formatted', { ascending: false, nullsFirst: false })
        .range(pageOffset, pageOffset + pageLimit - 1);

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
        console.error('Error fetching ads:', error);
        return [];
      }

      const ads: Ad[] = data || [];
      console.log('[getAds] batch loaded', {
        offset: pageOffset,
        limit: pageLimit,
        returned: ads.length,
      });

      // Process media file paths
      const bucket = process.env.NEXT_PUBLIC_AD_BUCKET || 'creatives';

      return ads.map((ad: Ad) => {
        const displayFormat = ad.display_format || 'IMAGE';
        const pathValue = ad.video_storage_path || ad.storage_path || '';
        let pathToUse = displayFormat === 'VIDEO' ? pathValue : ad.storage_path || '';

        if (!pathToUse) {
          pathToUse = `ads/${ad.ad_archive_id}/${ad.ad_archive_id}.jpeg`;
        }

        return {
          ...ad,
          image_url: `${bucket}/${pathToUse}`,
          video_preview_url:
            displayFormat === 'VIDEO' ? `${bucket}/${ad.storage_path || ''}` : undefined,
        };
      });
    }

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
 * Get unique page names
 */
export async function getUniquePages(businessId?: string): Promise<string[]> {
  try {
    const supabase = createServerSupabaseClient();

    const data = await fetchAllRecords(
      supabase,
      'ads',
      'page_name',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (query: any) => {
        let q = query.not('page_name', 'is', null).order('page_name');
        if (businessId) {
          q = q.eq('business_id', businessId);
        }
        return q;
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Array.from(new Set(data.map((item: any) => item.page_name)));
  } catch (error) {
    console.error('❌ Error in getUniquePages:', error);
    return [];
  }
}

/**
 * Get all ads in a group
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
 * Get list of businesses
 */
export async function getBusinesses(): Promise<{ id: string; name: string; slug: string }[]> {
  try {
    const supabase = createServerSupabaseClient();

    const businesses = await fetchAllRecords(supabase, 'businesses', 'id, name, slug', (query) =>
      query.order('name', { ascending: true })
    );

    return businesses.map((b) => ({
      id: String((b as Record<string, unknown>).id),
      name: String((b as Record<string, unknown>).name),
      slug: String((b as Record<string, unknown>).slug),
    }));
  } catch (error) {
    console.error('❌ Error in getBusinesses:', error);
    return [];
  }
}
export async function getAdsCount(): Promise<number> {
  'use server';
  noStore();

  try {
    const supabase = createServerSupabaseClient();

    const { count, error } = await supabase.from('ads').select('*', { count: 'exact' });

    console.log('📊 getAdsCount result:', { count, error });

    if (error) {
      console.error('Error counting ads:', error);
      return 0;
    }

    console.log('✅ Total ads in DB:', count);
    return count || 0;
  } catch (error) {
    console.error('Error in getAdsCount:', error);
    return 0;
  }
}

export async function getFilterOptions(): Promise<{
  pageNames: string[];
  displayFormats: string[];
  ctaTypes: string[];
  conceptFormats: string[];
  realizationFormats: string[];
  topicFormats: string[];
  hookFormats: string[];
  characterFormats: string[];
  publisherPlatforms: string[];
}> {
  'use server';
  noStore();

  try {
    const supabase = createServerSupabaseClient();

    console.log('🔧 Fetching filter options with distinct...');

    // Use separate requests with distinct for better performance
    const [
      { data: pageNamesData },
      { data: displayFormatsData },
      { data: ctaTypesData },
      { data: conceptFormatsData },
      { data: realizationFormatsData },
      { data: topicFormatsData },
      { data: hookFormatsData },
      { data: characterFormatsData },
      { data: publisherPlatformsData },
    ] = await Promise.all([
      supabase.from('ads').select('page_name').not('page_name', 'is', null),
      supabase.from('ads').select('display_format').not('display_format', 'is', null),
      supabase.from('ads').select('cta_type').not('cta_type', 'is', null),
      supabase.from('ads').select('concept').not('concept', 'is', null).neq('concept', ''),
      supabase
        .from('ads')
        .select('realization')
        .not('realization', 'is', null)
        .neq('realization', ''),
      supabase.from('ads').select('topic').not('topic', 'is', null).neq('topic', ''),
      supabase.from('ads').select('hook').not('hook', 'is', null).neq('hook', ''),
      supabase.from('ads').select('character').not('character', 'is', null).neq('character', ''),
      supabase.from('ads').select('publisher_platform').not('publisher_platform', 'is', null),
    ]);

    const extract = (r: Record<string, unknown>, k: string) => String(r[k] ?? '').trim();

    const pageNames = Array.from(
      new Set(
        (pageNamesData || [])
          .map((row: Record<string, unknown>) => extract(row, 'page_name'))
          .filter(Boolean)
      )
    ).sort();

    const displayFormats = Array.from(
      new Set(
        (displayFormatsData || [])
          .map((row: Record<string, unknown>) => extract(row, 'display_format'))
          .filter(Boolean)
      )
    ).sort();

    const ctaTypes = Array.from(
      new Set(
        (ctaTypesData || [])
          .map((row: Record<string, unknown>) => extract(row, 'cta_type'))
          .filter(Boolean)
      )
    ).sort();

    const conceptFormats = Array.from(
      new Set(
        (conceptFormatsData || [])
          .map((row: Record<string, unknown>) => extract(row, 'concept'))
          .filter(Boolean)
      )
    ).sort();

    const realizationFormats = Array.from(
      new Set(
        (realizationFormatsData || [])
          .map((row: Record<string, unknown>) => extract(row, 'realization'))
          .filter(Boolean)
      )
    ).sort();

    const topicFormats = Array.from(
      new Set(
        (topicFormatsData || [])
          .map((row: Record<string, unknown>) => extract(row, 'topic'))
          .filter(Boolean)
      )
    ).sort();

    const hookFormats = Array.from(
      new Set(
        (hookFormatsData || [])
          .map((row: Record<string, unknown>) => extract(row, 'hook'))
          .filter(Boolean)
      )
    ).sort();

    const characterFormats = Array.from(
      new Set(
        (characterFormatsData || [])
          .map((row: Record<string, unknown>) => extract(row, 'character'))
          .filter(Boolean)
      )
    ).sort();

    const publisherPlatforms = Array.from(
      new Set(
        (publisherPlatformsData || []).flatMap((row: Record<string, unknown>) => {
          const raw = extract(row, 'publisher_platform');
          return raw
            .split(',')
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean);
        })
      )
    ).sort();

    console.log('✅ Filter options loaded:', {
      pageNames: pageNames.length,
      displayFormats: displayFormats.length,
      ctaTypes: ctaTypes.length,
      conceptFormats: conceptFormats.length,
      realizationFormats: realizationFormats.length,
      topicFormats: topicFormats.length,
      hookFormats: hookFormats.length,
      characterFormats: characterFormats.length,
      publisherPlatforms: publisherPlatforms.length,
    });

    return {
      pageNames,
      displayFormats,
      ctaTypes,
      conceptFormats,
      realizationFormats,
      topicFormats,
      hookFormats,
      characterFormats,
      publisherPlatforms,
    };
  } catch (error) {
    console.error('Error in getFilterOptions:', error);
    return {
      pageNames: [],
      displayFormats: [],
      ctaTypes: [],
      conceptFormats: [],
      realizationFormats: [],
      topicFormats: [],
      hookFormats: [],
      characterFormats: [],
      publisherPlatforms: [],
    };
  }
}

/**
 * Fetch ALL ads from database in batches for filter counting
 * Used to compute accurate filter option counts across entire database
 */
export async function getAllAdsForCounting(
  search?: string,
  page?: string | null,
  date?: string | null,
  publisherPlatform?: string | null,
  businessId?: string
): Promise<Ad[]> {
  noStore();

  try {
    const supabase = createServerSupabaseClient();

    const batchSize = 1000;
    const allAds: Ad[] = [];
    let offset = 0;
    let hasMore = true;

    console.log('[getAllAdsForCounting] start', {
      search,
      page,
      date,
      publisherPlatform,
      businessId,
      batchSize,
    });

    while (hasMore) {
      try {
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
            cta_type,
            display_format,
            link_url,
            title,
            storage_path,
            video_storage_path,
            vector_group,
            created_at,
            start_date_formatted,
            concept,
            realization,
            topic,
            hook,
            character,
            duplicates_count,
            url
          `
          )
          .order('start_date_formatted', { ascending: false, nullsFirst: false })
          .range(offset, offset + batchSize - 1);

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
          console.error('❌ Error fetching ads batch for counting:', error);
          // Return what we have so far instead of complete failure
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        const batch: Ad[] = data;
        allAds.push(...batch);
        offset += batchSize;

        console.log('[getAllAdsForCounting] batch', {
          batchSize: batch.length,
          totalCollected: allAds.length,
          nextOffset: offset,
        });

        // Safety limit to prevent infinite loops
        if (allAds.length > 50000) {
          console.warn('⚠️ Reached 50k ads limit for counting');
          hasMore = false;
        }
      } catch (error) {
        console.error('❌ Error fetching ads batch:', error);
        // Return what we have so far instead of complete failure
        break;
      }
    }

    console.log('[getAllAdsForCounting] done', { total: allAds.length });
    return allAds;
  } catch (error) {
    console.error('❌ Error in getAllAdsForCounting:', error);
    return [];
  }
}
