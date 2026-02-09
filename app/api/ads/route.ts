import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export const dynamic = 'force-dynamic';

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

const chunk = <T>(arr: T[], size = 500) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Escape special characters for SQL LIKE queries
const escapeSql = (str: string) => {
  return str.replace(/[%_']/g, '\\$&');
};

export async function GET(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const url = new URL(req.url);
    const params = url.searchParams;

    const businessId = params.get('businessId') || null;
    const limit = Number(params.get('limit') || '36');
    const offset = Number(params.get('offset') || '0');

    if (!businessId) {
      return NextResponse.json({ data: [], hasMore: false, limit, offset });
    }

    // Parse filters from query params
    const getList = (k: string) => {
      const all = params
        .getAll(k)
        .map((s) => s.trim())
        .filter(Boolean);
      if (all.length) return all;
      return (params.get(k) || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    };
    const pageNames = getList('pageNames');
    const displayFormats = getList('displayFormats');
    const ctaTypes = getList('ctaTypes');
    const concepts = getList('concepts');
    const realizations = getList('realizations');
    const topics = getList('topics');
    const hooks = getList('hooks');
    const characters = getList('characters');
    const platforms = getList('platforms');
    const funnels = getList('funnels');
    const variationCounts = getList('variationCounts');
    // const dateRanges = getList('dateRanges');
    const search = (params.get('search') || '').trim();

    // 1) Get ALL representative IDs for this business
    const allReps = (await fetchAllRecords(
      supabase,
      'ads_groups_test',
      'vector_group, rep_ad_archive_id, items',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (query: any) => query.eq('business_id', businessId)
    )) as Array<Record<string, unknown>>;
    const allRepIds = allReps.map((r) => String(r.rep_ad_archive_id)).filter(Boolean);

    if (allRepIds.length === 0) {
      return NextResponse.json({
        data: [],
        hasMore: false,
        limit,
        offset,
        groupSizes: {},
        groupAdsMap: {},
      });
    }

    // 2) Fetch all representative ads and apply filters
    const repChunks = chunk(allRepIds, 500);
    const filteredRepIds: string[] = [];

    for (const c of repChunks) {
      let query = supabase
        .from('ads')
        .select(
          'ad_archive_id, page_name, publisher_platform, display_format, cta_type, concept, realization, topic, hook, character, link_url, duplicates_count'
        )
        .in('ad_archive_id', c)
        .eq('business_id', businessId);

      // Apply filters
      if (pageNames.length) query = query.in('page_name', pageNames);
      if (displayFormats.length) query = query.in('display_format', displayFormats);
      if (ctaTypes.length) query = query.in('cta_type', ctaTypes);
      if (concepts.length) query = query.in('concept', concepts);
      if (realizations.length) query = query.in('realization', realizations);
      if (topics.length) query = query.in('topic', topics);
      if (hooks.length) query = query.in('hook', hooks);
      if (characters.length) query = query.in('character', characters);

      if (platforms.length) {
        const ors = platforms.map((p) => `publisher_platform.ilike.%${escapeSql(p)}%`).join(',');
        query = query.or(ors);
      }

      if (variationCounts.length) {
        const orParts: string[] = [];
        variationCounts.forEach((b) => {
          if (b === 'more_than_10') orParts.push('duplicates_count.gt.10');
          else if (b === '5_10')
            orParts.push('and(duplicates_count.gte.5,duplicates_count.lte.10)');
          else if (b === '3_5') orParts.push('and(duplicates_count.gte.3,duplicates_count.lte.5)');
          else if (b === 'less_than_3') orParts.push('duplicates_count.lt.3');
        });
        if (orParts.length) query = query.or(orParts.join(','));
      }

      if (funnels.length) {
        const ors: string[] = [];
        funnels.forEach((f) => {
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
        filteredRepIds.push(String((a as Record<string, unknown>).ad_archive_id));
      });
    }

    // 3) Paginate filtered rep IDs
    const paginatedRepIds = filteredRepIds.slice(offset, offset + limit);
    const hasMore = filteredRepIds.length > offset + limit;

    if (paginatedRepIds.length === 0) {
      return NextResponse.json({
        data: [],
        hasMore: false,
        limit,
        offset,
        groupSizes: {},
        groupAdsMap: {},
      });
    }

    // 4) Fetch full ad records for paginated reps
    const adsById: Record<string, Record<string, unknown>> = {};
    const pagedChunks = chunk(paginatedRepIds, 500);
    for (const c of pagedChunks) {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .in('ad_archive_id', c)
        .eq('business_id', businessId);
      if (error) throw error;
      (data || []).forEach((a: unknown) => {
        adsById[String((a as Record<string, unknown>).ad_archive_id)] = a as Record<
          string,
          unknown
        >;
      });
    }

    // 5) Build group metadata
    const repToGroupData = new Map<string, Record<string, unknown>>();
    allReps.forEach((r) => {
      const repId = String(r.rep_ad_archive_id);
      if (paginatedRepIds.includes(repId)) {
        repToGroupData.set(repId, r);
      }
    });

    // 6) For groupAdsMap: fetch ads where vector_group IN (filtered groups)
    const vectorGroups = Array.from(repToGroupData.values())
      .map((r) => r.vector_group)
      .filter((v: unknown) => v !== null && v !== undefined);

    const groupAdsMap: Record<string, string[]> = {};
    if (vectorGroups.length) {
      const groupAds = await fetchAllRecords(
        supabase,
        'ads',
        'ad_archive_id, vector_group',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (query: any) => query.in('vector_group', vectorGroups).eq('business_id', businessId)
      );
      groupAds.forEach((a: unknown) => {
        const vg = String((a as Record<string, unknown>).vector_group);
        groupAdsMap[vg] = groupAdsMap[vg] || [];
        groupAdsMap[vg].push(String((a as Record<string, unknown>).ad_archive_id));
      });
    }

    // 7) Build response
    const data = paginatedRepIds.map((repId) => adsById[repId]).filter(Boolean);

    const groupSizes: Record<string, number> = {};
    const groupAdsMapByRep: Record<string, string[]> = {};
    const groupAdsDetailsMap: Record<string, Array<Record<string, unknown>>> = {};

    // Build a lookup of all group ad IDs so we can fetch their full records
    const allGroupAdIds = Array.from(
      new Set(vectorGroups.flatMap((vg) => groupAdsMap[String(vg)] || []))
    );

    const groupAdsById: Record<string, Record<string, unknown>> = {};
    if (allGroupAdIds.length) {
      const idChunks = chunk(allGroupAdIds, 500);
      for (const c of idChunks) {
        const { data: groupAds, error } = await supabase
          .from('ads')
          .select('*')
          .in('ad_archive_id', c)
          .eq('business_id', businessId);
        if (error) throw error;
        (groupAds || []).forEach((a: unknown) => {
          groupAdsById[String((a as Record<string, unknown>).ad_archive_id)] = a as Record<
            string,
            unknown
          >;
        });
      }
    }

    paginatedRepIds.forEach((repId) => {
      const groupData = repToGroupData.get(repId);
      if (groupData) {
        groupSizes[repId] = Number(groupData.items || 0);
        const vg = String(groupData.vector_group);
        groupAdsMapByRep[repId] = groupAdsMap[vg] || [];
        groupAdsDetailsMap[repId] = (groupAdsMapByRep[repId] || [])
          .map((id) => groupAdsById[String(id)])
          .filter(Boolean);
      }
    });

    return NextResponse.json({
      data,
      hasMore,
      limit,
      offset,
      groupSizes,
      groupAdsMap: groupAdsMapByRep,
      groupAdsDetailsMap,
    });
  } catch (err) {
    console.error('[ADS_ROUTE_ERROR]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST - create new creative
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.from('ads').insert([body]).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
