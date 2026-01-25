import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';
import type {
  CompetitorAnalytics,
  CompetitorBreakdown,
  DistributionItem,
  VisualPattern,
  FormatDistribution,
  DurationDistribution,
  CharacterDistribution,
  TrendsData,
  TimeSeriesData,
} from '@/lib/core/types';
import * as archiveUtils from '@/app/ad-archive-browser/utils';
import type { Ad } from '@/lib/core/types';

export const dynamic = 'force-dynamic';

interface CompetitorAnalyticsRequest {
  competitors: string[];
}

/**
 * Extract funnels from ad (same logic as FilteredContainer)
 */
function extractFunnelsFromAd(ad: Record<string, unknown>): string[] {
  const set: Set<string> = new Set();
  const addUrl = (raw?: string | null) => {
    if (!raw) return;
    const str = String(raw);
    try {
      const urlRe = /https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+/gi;
      const matches = str.match(urlRe) || (str.includes('/') ? [str] : []);
      for (const m of matches) {
        try {
          const u = new URL(m);
          const hostAndPath = (u.host + u.pathname).replace(/\/+$/, '').toLowerCase();
          set.add(hostAndPath);
          if (u.pathname && u.pathname !== '/') set.add(u.pathname.toLowerCase());
        } catch (e) {
          const cleaned = String(m).replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
          if (cleaned) set.add('/' + cleaned);
        }
      }
    } catch (e) {
      // noop
    }
  };
  addUrl(ad.link_url as string | undefined);
  addUrl(ad.meta_ad_url as string | undefined);
  const dupLinks = ad.duplicates_links as string | undefined;
  if (dupLinks) addUrl(dupLinks);
  if (ad.text) addUrl(ad.text as string);
  return Array.from(set);
}

/**
 * Cluster visual descriptions into patterns
 */
function clusterVisualPatterns(
  ads: Array<Record<string, unknown>>,
  maxPatterns = 10
): VisualPattern[] {
  const descriptions = ads
    .map((ad) => {
      const desc = (ad.image_description as string) || '';
      return desc.trim();
    })
    .filter((d) => d.length > 20);

  if (descriptions.length === 0) return [];

  // Simple keyword-based clustering
  const keywordGroups: Record<string, string[]> = {};
  const commonKeywords = [
    'person',
    'woman',
    'man',
    'product',
    'phone',
    'screen',
    'text',
    'background',
    'smiling',
    'holding',
    'close-up',
    'video',
    'animation',
  ];

  for (const desc of descriptions) {
    const lower = desc.toLowerCase();
    let matched = false;
    for (const keyword of commonKeywords) {
      if (lower.includes(keyword)) {
        if (!keywordGroups[keyword]) keywordGroups[keyword] = [];
        keywordGroups[keyword].push(desc);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!keywordGroups['other']) keywordGroups['other'] = [];
      keywordGroups['other'].push(desc);
    }
  }

  const patterns: VisualPattern[] = [];
  for (const [keyword, examples] of Object.entries(keywordGroups)) {
    if (examples.length > 0) {
      patterns.push({
        id: keyword,
        name: keyword.charAt(0).toUpperCase() + keyword.slice(1) + ' Focus',
        description: `Creatives featuring ${keyword}-related visual elements`,
        count: examples.length,
        examples: examples.slice(0, 3),
      });
    }
  }

  return patterns
    .sort((a, b) => b.count - a.count)
    .slice(0, maxPatterns)
    .map((p, idx) => ({ ...p, id: `pattern_${idx}` }));
}

function computeVariationCounts(ads: Array<Record<string, unknown>>): Record<string, number> {
  const groupMap = new Map<string, Ad[]>();
  for (const ad of ads) {
    const key = archiveUtils.getGroupingKey(ad as unknown as Ad);
    const arr = groupMap.get(key) ?? [];
    arr.push(ad as unknown as Ad);
    groupMap.set(key, arr);
  }

  const phashKeys = Array.from(groupMap.keys()).filter((k) => String(k).startsWith('phash:'));

  // cast through unknown/any to satisfy the helper's expected Ad[] map without strict structural checks
  const { keyToRep, repSize } = archiveUtils.buildPhashClustersFromKeys(phashKeys, groupMap, 4);

  const counts: Record<string, number> = {};
  for (const ad of ads) {
    const key = archiveUtils.getGroupingKey(ad as unknown as Ad);
    const mapped = keyToRep.get(key) ?? key;
    let effectiveSize = 0;
    if (String(mapped).startsWith('phash:')) {
      effectiveSize = repSize.get(mapped) ?? groupMap.get(mapped)?.length ?? 1;
    } else {
      effectiveSize = groupMap.get(key)?.length ?? 1;
    }
    counts[String((ad as unknown as Ad).id)] = Math.max(0, effectiveSize - 1);
  }
  return counts;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as CompetitorAnalyticsRequest | null;
    const competitors = Array.isArray(body?.competitors) ? body.competitors : [];

    if (competitors.length === 0) {
      return NextResponse.json({ error: 'competitors array is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Fetch all ads for selected competitors
    let ads: Array<Record<string, unknown>> | null = null;
    let error: Error | null = null;

    try {
      const result = await supabase
        .from('ads')
        .select('*')
        .in('page_name', competitors)
        .order('created_at', { ascending: false });

      if (result.error) {
        error = new Error(result.error.message || 'Database query failed');
        console.error('[Competitor Analytics] Supabase error:', result.error);
      } else {
        ads = result.data;
      }
    } catch (err) {
      error = err instanceof Error ? err : new Error('Database connection failed');
      console.error('[Competitor Analytics] Query error:', err);

      // Check if it's a Cloudflare/Supabase connection error
      const errMsg = String(err);
      if (errMsg.includes('Cloudflare') || errMsg.includes('Temporarily unavailable')) {
        return NextResponse.json(
          {
            error: 'Database temporarily unavailable. Please try again in a few moments.',
            code: 'DB_UNAVAILABLE',
          },
          { status: 503 }
        );
      }
    }

    if (error || !ads) {
      return NextResponse.json(
        {
          error: error?.message || 'Failed to query database',
          code: 'QUERY_FAILED',
        },
        { status: 502 }
      );
    }

    if (!ads || ads.length === 0) {
      return NextResponse.json(
        {
          totalCreatives: 0,
          competitorBreakdown: competitors.map((c) => ({ competitor: c, count: 0, percentage: 0 })),
          averageVariationCount: 0,
          funnelsUsed: 0,
          themesUsed: 0,
          mechanicsUsed: 0,
          themeDistribution: [],
          hookDistribution: [],
          funnelDistribution: [],
          mechanicDistribution: [],
          visualPatterns: [],
          formatDistribution: { video: 0, static: 0, carousel: 0, other: 0 },
          durationDistribution: { ranges: [], mostCommon: [] },
          characterDistribution: { types: [], mostCommon: '' },
          trendsOverTime: {
            themesOverTime: [],
            funnelsOverTime: [],
            patternsOverTime: [],
            insights: { increasing: [], decreasing: [] },
          },
        } as CompetitorAnalytics,
        { status: 200 }
      );
    }

    const adsArray = ads;

    // Competitor breakdown
    const competitorCounts: Record<string, number> = {};
    for (const ad of adsArray) {
      const page = String(ad.page_name || '');
      competitorCounts[page] = (competitorCounts[page] || 0) + 1;
    }
    const total = adsArray.length;
    const competitorBreakdown: CompetitorBreakdown[] = competitors.map((c) => ({
      competitor: c,
      count: competitorCounts[c] || 0,
      percentage: total > 0 ? Math.round(((competitorCounts[c] || 0) / total) * 100) : 0,
    }));

    // Variation counts
    const variationCounts = computeVariationCounts(adsArray);
    const avgVariation =
      Object.values(variationCounts).reduce((a, b) => a + b, 0) / adsArray.length;

    // Funnels
    const funnelSet = new Set<string>();
    for (const ad of adsArray) {
      const funnels = extractFunnelsFromAd(ad);
      for (const f of funnels) funnelSet.add(f);
    }
    const funnelsUsed = funnelSet.size;

    // Themes (topic field)
    const themeSet = new Set<string>();
    for (const ad of adsArray) {
      const topic = String(ad.topic || '').trim();
      if (topic) themeSet.add(topic);
    }
    const themesUsed = themeSet.size;

    // Mechanics (realisation field)
    const mechanicSet = new Set<string>();
    for (const ad of adsArray) {
      const real = String(ad.realisation || '').trim();
      if (real) mechanicSet.add(real);
    }
    const mechanicsUsed = mechanicSet.size;

    // Theme distribution
    const themeCounts: Record<string, number> = {};
    for (const ad of adsArray) {
      const topic = String(ad.topic || '').trim();
      if (topic) themeCounts[topic] = (themeCounts[topic] || 0) + 1;
    }
    const themeDistribution: DistributionItem[] = Object.entries(themeCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Hook distribution
    const hookCounts: Record<string, number> = {};
    for (const ad of adsArray) {
      const hook = String(ad.hook || '').trim();
      if (hook) hookCounts[hook] = (hookCounts[hook] || 0) + 1;
    }
    const hookDistribution: DistributionItem[] = Object.entries(hookCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Funnel distribution
    const funnelCounts: Record<string, number> = {};
    for (const ad of adsArray) {
      const funnels = extractFunnelsFromAd(ad);
      for (const f of funnels) funnelCounts[f] = (funnelCounts[f] || 0) + 1;
    }
    const funnelDistribution: DistributionItem[] = Object.entries(funnelCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Mechanic distribution
    const mechanicCounts: Record<string, number> = {};
    for (const ad of adsArray) {
      const real = String(ad.realisation || '').trim();
      if (real) mechanicCounts[real] = (mechanicCounts[real] || 0) + 1;
    }
    const mechanicDistribution: DistributionItem[] = Object.entries(mechanicCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Visual patterns
    const visualPatterns = clusterVisualPatterns(adsArray, 10);

    // Format distribution
    const formatCounts: Record<string, number> = {};
    for (const ad of adsArray) {
      const fmt = String(ad.display_format || '').toUpperCase();
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
    }
    const formatDistribution: FormatDistribution = {
      video: formatCounts['VIDEO'] || 0,
      static: formatCounts['IMAGE'] || 0,
      carousel: formatCounts['CAROUSEL'] || 0,
      other:
        total -
        (formatCounts['VIDEO'] || 0) -
        (formatCounts['IMAGE'] || 0) -
        (formatCounts['CAROUSEL'] || 0),
    };

    // Duration distribution (for videos, estimate from video_script or default)
    const durationRanges: Record<string, number> = {
      '0-15s': 0,
      '15-30s': 0,
      '30-60s': 0,
      '60s+': 0,
    };
    for (const ad of adsArray) {
      if (String(ad.display_format).toUpperCase() === 'VIDEO') {
        const script = String(ad.video_script || '');
        // Simple heuristic: count time markers
        const timeMatches = script.match(/\d{2}:\d{2}/g);
        if (timeMatches && timeMatches.length > 0) {
          const lastTime = timeMatches[timeMatches.length - 1];
          const [min, sec] = lastTime.split(':').map(Number);
          const totalSec = min * 60 + sec;
          if (totalSec <= 15) durationRanges['0-15s']++;
          else if (totalSec <= 30) durationRanges['15-30s']++;
          else if (totalSec <= 60) durationRanges['30-60s']++;
          else durationRanges['60s+']++;
        } else {
          durationRanges['0-15s']++; // default
        }
      }
    }
    const mostCommonDurations = Object.entries(durationRanges)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([range]) => range);
    const durationDistribution: DurationDistribution = {
      ranges: Object.entries(durationRanges).map(([range, count]) => ({ range, count })),
      mostCommon: mostCommonDurations,
    };

    // Character distribution
    const characterCounts: Record<string, number> = {};
    for (const ad of adsArray) {
      const char = String(ad.character || '').trim();
      if (char) characterCounts[char] = (characterCounts[char] || 0) + 1;
    }
    const characterTypes = Object.entries(characterCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    const mostCommonCharacter = characterTypes.length > 0 ? characterTypes[0].type : '';
    const characterDistribution: CharacterDistribution = {
      types: characterTypes.slice(0, 10),
      mostCommon: mostCommonCharacter,
    };

    // Trends over time (group by week/month)
    const trendsByWeek: Record<string, Record<string, number>> = {};
    const themeTrends: Record<string, Record<string, number>> = {};
    const funnelTrends: Record<string, Record<string, number>> = {};

    for (const ad of adsArray) {
      const date = new Date(String(ad.created_at || ''));
      if (isNaN(date.getTime())) continue;
      const weekKey = `${date.getFullYear()}-W${Math.ceil(
        (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
      )}`;

      if (!trendsByWeek[weekKey]) trendsByWeek[weekKey] = {};
      trendsByWeek[weekKey]['total'] = (trendsByWeek[weekKey]['total'] || 0) + 1;

      const topic = String(ad.topic || '').trim();
      if (topic) {
        if (!themeTrends[weekKey]) themeTrends[weekKey] = {};
        themeTrends[weekKey][topic] = (themeTrends[weekKey][topic] || 0) + 1;
      }

      const funnels = extractFunnelsFromAd(ad);
      for (const f of funnels.slice(0, 1)) {
        // Top funnel per ad
        if (!funnelTrends[weekKey]) funnelTrends[weekKey] = {};
        funnelTrends[weekKey][f] = (funnelTrends[weekKey][f] || 0) + 1;
      }
    }

    const themesOverTime: TimeSeriesData[] = Object.entries(themeTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, series]) => ({
        date,
        series: Object.entries(series).map(([name, value]) => ({ name, value: value as number })),
      }))
      .slice(-12); // Last 12 weeks

    const funnelsOverTime: TimeSeriesData[] = Object.entries(funnelTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, series]) => ({
        date,
        series: Object.entries(series)
          .map(([name, value]) => ({ name, value: value as number }))
          .slice(0, 5), // Top 5 funnels per week
      }))
      .slice(-12);

    const patternsOverTime: TimeSeriesData[] = []; // Simplified for now

    // Insights: compare last 4 weeks vs previous 4 weeks
    const recentWeeks = Object.keys(trendsByWeek).sort().slice(-4);
    const previousWeeks = Object.keys(trendsByWeek).sort().slice(-8, -4);
    const recentThemeCounts: Record<string, number> = {};
    const previousThemeCounts: Record<string, number> = {};

    for (const week of recentWeeks) {
      const series = themeTrends[week] || {};
      for (const [theme, count] of Object.entries(series)) {
        recentThemeCounts[theme] = (recentThemeCounts[theme] || 0) + (count as number);
      }
    }
    for (const week of previousWeeks) {
      const series = themeTrends[week] || {};
      for (const [theme, count] of Object.entries(series)) {
        previousThemeCounts[theme] = (previousThemeCounts[theme] || 0) + (count as number);
      }
    }

    const increasing: string[] = [];
    const decreasing: string[] = [];
    for (const theme of Object.keys({ ...recentThemeCounts, ...previousThemeCounts })) {
      const recent = recentThemeCounts[theme] || 0;
      const previous = previousThemeCounts[theme] || 0;
      if (recent > previous * 1.2) increasing.push(theme);
      else if (recent < previous * 0.8 && previous > 0) decreasing.push(theme);
    }

    const trendsOverTime: TrendsData = {
      themesOverTime,
      funnelsOverTime,
      patternsOverTime,
      insights: {
        increasing: increasing.slice(0, 5),
        decreasing: decreasing.slice(0, 5),
      },
    };

    const analytics: CompetitorAnalytics = {
      totalCreatives: total,
      competitorBreakdown,
      averageVariationCount: Math.round(avgVariation * 10) / 10,
      funnelsUsed,
      themesUsed,
      mechanicsUsed,
      themeDistribution,
      hookDistribution,
      funnelDistribution,
      mechanicDistribution,
      visualPatterns,
      formatDistribution,
      durationDistribution,
      characterDistribution,
      trendsOverTime,
    };

    return NextResponse.json(analytics, { status: 200 });
  } catch (err) {
    console.error('[Competitor Analytics] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
