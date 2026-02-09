import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export const dynamic = 'force-dynamic';

const chunk = <T>(arr: T[], size = 500) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Escape special characters for SQL LIKE queries
const escapeSql = (str: string) => {
  return str.replace(/[%_']/g, '\\$&');
};

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

type FilterKey =
  | 'pageNames'
  | 'displayFormats'
  | 'ctaTypes'
  | 'concepts'
  | 'realizations'
  | 'topics'
  | 'hooks'
  | 'characters'
  | 'platforms'
  | 'funnels'
  | 'variationCounts';

export async function GET(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(req.url);

    const businessId = searchParams.get('businessId') || null;
    const search = (searchParams.get('search') || '').trim();
    const representativesOnly = searchParams.get('representativesOnly') !== 'false'; // default true

    // Parse lists from querystring
    const getList = (k: string) => {
      const all = searchParams
        .getAll(k)
        .map((s) => s.trim())
        .filter(Boolean);
      if (all.length) return all;
      return (searchParams.get(k) || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const filters = {
      pageNames: getList('pageNames'),
      displayFormats: getList('displayFormats'),
      ctaTypes: getList('ctaTypes'),
      concepts: getList('concepts'),
      realizations: getList('realizations'),
      topics: getList('topics'),
      hooks: getList('hooks'),
      characters: getList('characters'),
      platforms: getList('platforms'),
      funnels: getList('funnels'),
      variationCounts: getList('variationCounts'),
    };

    // 0) Get businesses list
    const businesses = await fetchAllRecords(supabase, 'businesses', 'id, name, slug', (query) =>
      query.order('name', { ascending: true })
    );

    // 1) Get representative IDs for this business (only reps)
    let repIds: string[] = [];
    if (businessId) {
      const reps = await fetchAllRecords(
        supabase,
        'ads_groups_test',
        'rep_ad_archive_id',
        (query) => query.eq('business_id', businessId)
      );
      repIds = (reps || [])
        .map((r: unknown) => String((r as Record<string, unknown>).rep_ad_archive_id))
        .filter(Boolean);
    }

    // If representativesOnly and no reps -> return empty facets
    if (representativesOnly && businessId && repIds.length === 0) {
      return NextResponse.json({
        data: {
          pageNames: [],
          publisherPlatforms: [],
          displayFormats: [],
          ctaTypes: [],
          conceptFormats: [],
          realizationFormats: [],
          topicFormats: [],
          hookFormats: [],
          characterFormats: [],
          funnels: [],
          counts: {},
          businesses: businesses as Array<Record<string, unknown>>,
          variationBuckets: ['more_than_10', '5_10', '3_5', 'less_than_3'],
          dateRangeOptions: ['today', 'week', 'month', 'quarter'],
        },
      });
    }

    // 2) Helper: Fetch filtered ads with cross-filtering (ignore one key when computing its facet)
    const fetchFilteredAds = async (ignoreKey: FilterKey | null) => {
      const filteredIds: string[] = [];
      const repChunks = chunk(repIds, 500);

      for (const c of repChunks) {
        let query = supabase
          .from('ads')
          .select(
            'ad_archive_id, page_name, publisher_platform, display_format, cta_type, concept, realization, topic, hook, character, link_url, duplicates_count'
          )
          .in('ad_archive_id', c)
          .eq('business_id', businessId);

        // Apply filters (skip the one we're computing)
        if (ignoreKey !== 'pageNames' && filters.pageNames.length) {
          query = query.in('page_name', filters.pageNames);
        }
        if (ignoreKey !== 'displayFormats' && filters.displayFormats.length) {
          query = query.in('display_format', filters.displayFormats);
        }
        if (ignoreKey !== 'ctaTypes' && filters.ctaTypes.length) {
          query = query.in('cta_type', filters.ctaTypes);
        }
        if (ignoreKey !== 'concepts' && filters.concepts.length) {
          query = query.in('concept', filters.concepts);
        }
        if (ignoreKey !== 'realizations' && filters.realizations.length) {
          query = query.in('realization', filters.realizations);
        }
        if (ignoreKey !== 'topics' && filters.topics.length) {
          query = query.in('topic', filters.topics);
        }
        if (ignoreKey !== 'hooks' && filters.hooks.length) {
          query = query.in('hook', filters.hooks);
        }
        if (ignoreKey !== 'characters' && filters.characters.length) {
          query = query.in('character', filters.characters);
        }

        if (ignoreKey !== 'platforms' && filters.platforms.length) {
          const ors = filters.platforms
            .map((p) => `publisher_platform.ilike.%${escapeSql(p)}%`)
            .join(',');
          query = query.or(ors);
        }

        if (ignoreKey !== 'variationCounts' && filters.variationCounts.length) {
          const orParts: string[] = [];
          filters.variationCounts.forEach((b) => {
            if (b === 'more_than_10') orParts.push('duplicates_count.gt.10');
            else if (b === '5_10')
              orParts.push('and(duplicates_count.gte.5,duplicates_count.lte.10)');
            else if (b === '3_5')
              orParts.push('and(duplicates_count.gte.3,duplicates_count.lte.5)');
            else if (b === 'less_than_3') orParts.push('duplicates_count.lt.3');
          });
          if (orParts.length) query = query.or(orParts.join(','));
        }

        if (ignoreKey !== 'funnels' && filters.funnels.length) {
          const ors: string[] = [];
          filters.funnels.forEach((f) => {
            if (!f) return;
            const clean = f.replace(/https?:\/\//, '').split('/')[0];
            ors.push(`link_url.ilike.%${escapeSql(clean)}%`);
          });
          if (ors.length) query = query.or(ors.join(','));
        }

        if (search) {
          const escapedSearch = escapeSql(search);
          query = query.or(
            `page_name.ilike.%${escapedSearch}%,title.ilike.%${escapedSearch}%,text.ilike.%${escapedSearch}%,caption.ilike.%${escapedSearch}%`
          );
        }

        const { data, error } = await query;
        if (error) throw error;

        (data || []).forEach((a: unknown) => {
          filteredIds.push(String((a as Record<string, unknown>).ad_archive_id));
        });
      }

      return filteredIds;
    };

    // 3) Fetch ads for each facet with cross-filtering
    const fetchFacetData = async (ignoreKey: FilterKey | null) => {
      const filteredIds = await fetchFilteredAds(ignoreKey);

      if (filteredIds.length === 0) {
        return [];
      }

      const rows: Array<Record<string, unknown>> = [];
      const idChunks = chunk(filteredIds, 500);

      for (const c of idChunks) {
        const { data, error } = await supabase
          .from('ads')
          .select(
            'ad_archive_id, page_name, publisher_platform, display_format, cta_type, concept, realization, topic, hook, character, link_url, duplicates_count'
          )
          .in('ad_archive_id', c)
          .eq('business_id', businessId);
        if (error) throw error;
        (data || []).forEach((d: unknown) => rows.push(d as Record<string, unknown>));
      }

      return rows;
    };

    // 4) Calculate counts for each facet
    const calculateCounts = (rows: Array<Record<string, unknown>>, key: FilterKey) => {
      const counts: Record<string, number> = {};

      rows.forEach((r: Record<string, unknown>) => {
        if (key === 'platforms') {
          const platformRaw = String(r.publisher_platform || '');
          platformRaw
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .forEach((p: string) => {
              counts[p] = (counts[p] || 0) + 1;
            });
        } else if (key === 'variationCounts') {
          const d = Number(r.duplicates_count || 0);
          let bucket = 'less_than_3';
          if (d > 10) bucket = 'more_than_10';
          else if (d >= 5) bucket = '5_10';
          else if (d >= 3) bucket = '3_5';
          counts[bucket] = (counts[bucket] || 0) + 1;
        } else if (key === 'funnels') {
          const linkUrl = r.link_url;
          if (typeof linkUrl === 'string') {
            try {
              const hostname = (
                linkUrl.startsWith('http') ? new URL(linkUrl).hostname : linkUrl.split('/')[0]
              )
                .replace('www.', '')
                .toLowerCase();
              if (hostname) counts[hostname] = (counts[hostname] || 0) + 1;
            } catch (e) {}
          }
        } else {
          const colMap: Record<string, string> = {
            pageNames: 'page_name',
            displayFormats: 'display_format',
            ctaTypes: 'cta_type',
            concepts: 'concept',
            realizations: 'realization',
            topics: 'topic',
            hooks: 'hook',
            characters: 'character',
          };
          const col = colMap[key];
          if (col) {
            const val = String(r[col] || '').trim();
            if (val) counts[val] = (counts[val] || 0) + 1;
          }
        }
      });

      return counts;
    };

    // 5) Fetch data for each facet in parallel
    const [
      pageRows,
      platformRows,
      displayRows,
      ctaRows,
      conceptRows,
      realizationRows,
      topicRows,
      hookRows,
      charRows,
      funnelRows,
      variationRows,
    ] = await Promise.all([
      fetchFacetData('pageNames'),
      fetchFacetData('platforms'),
      fetchFacetData('displayFormats'),
      fetchFacetData('ctaTypes'),
      fetchFacetData('concepts'),
      fetchFacetData('realizations'),
      fetchFacetData('topics'),
      fetchFacetData('hooks'),
      fetchFacetData('characters'),
      fetchFacetData('funnels'),
      fetchFacetData('variationCounts'),
    ]);

    // 6) Calculate counts
    const counts = {
      pageNames: calculateCounts(pageRows, 'pageNames'),
      publisherPlatforms: calculateCounts(platformRows, 'platforms'),
      displayFormats: calculateCounts(displayRows, 'displayFormats'),
      ctaTypes: calculateCounts(ctaRows, 'ctaTypes'),
      conceptFormats: calculateCounts(conceptRows, 'concepts'),
      realizationFormats: calculateCounts(realizationRows, 'realizations'),
      topicFormats: calculateCounts(topicRows, 'topics'),
      hookFormats: calculateCounts(hookRows, 'hooks'),
      characterFormats: calculateCounts(charRows, 'characters'),
      funnels: calculateCounts(funnelRows, 'funnels'),
      variationCounts: calculateCounts(variationRows, 'variationCounts'),
    };

    // Convert counts -> sorted options
    const toOptions = (map: Record<string, number> = {}) => Object.keys(map).sort();

    const result = {
      data: {
        pageNames: toOptions(counts.pageNames),
        publisherPlatforms: toOptions(counts.publisherPlatforms),
        displayFormats: toOptions(counts.displayFormats),
        ctaTypes: toOptions(counts.ctaTypes),
        conceptFormats: toOptions(counts.conceptFormats),
        realizationFormats: toOptions(counts.realizationFormats),
        topicFormats: toOptions(counts.topicFormats),
        hookFormats: toOptions(counts.hookFormats),
        characterFormats: toOptions(counts.characterFormats),
        funnels: toOptions(counts.funnels),
        counts: {
          pageNames: counts.pageNames,
          publisherPlatforms: counts.publisherPlatforms,
          displayFormats: counts.displayFormats,
          ctaTypes: counts.ctaTypes,
          conceptFormats: counts.conceptFormats,
          realizationFormats: counts.realizationFormats,
          topicFormats: counts.topicFormats,
          hookFormats: counts.hookFormats,
          characterFormats: counts.characterFormats,
          variationCounts: counts.variationCounts,
          funnels: counts.funnels,
          dateRanges: {},
        },
        businesses: businesses || [],
        variationBuckets: ['more_than_10', '5_10', '3_5', 'less_than_3'],
        dateRangeOptions: ['today', 'week', 'month', 'quarter'],
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[FACETS_ERROR]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
