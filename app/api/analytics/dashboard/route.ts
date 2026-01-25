import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';
import type {
  CompetitorAnalytics,
  CompetitorBreakdown,
  DistributionItem,
  TimeSeriesData,
  VisualPattern,
  FormatDistribution,
  DurationDistribution,
  CharacterDistribution,
  Ad,
  TrendsData,
} from '@/lib/core/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const competitors = searchParams.getAll('competitors');

    if (!competitors || competitors.length === 0) {
      return NextResponse.json({ error: 'No competitors selected' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Fetch all ads for selected competitors
    const { data: ads, error } = await supabase
      .from('ads')
      .select('*')
      .in('page_name', competitors);

    if (error) {
      console.error('Error fetching ads:', error);
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }

    const adsData = (ads || []) as Ad[];

    // Calculate analytics
    const analytics = calculateAnalytics(adsData, competitors);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json({ error: 'Failed to process analytics' }, { status: 500 });
  }
}

function calculateAnalytics(ads: Ad[], selectedCompetitors: string[]): CompetitorAnalytics {
  const totalCreatives = ads.length;

  // Variation grouping (approximate): group by creative_hash/ad_archive_id/image_url/text snippet
  const variationCounts: number[] = [];
  try {
    const groupMap = new Map<string, Ad[]>();
    const getKey = (ad: Ad) => {
      const maybeHash = (ad as unknown as { creative_hash?: string; creative_phash?: string })
        .creative_phash;
      if (maybeHash) return `phash:${String(maybeHash).trim()}`;
      if (ad.ad_archive_id) return `archive:${ad.ad_archive_id}`;
      if (ad.image_url) return `img:${ad.image_url.split('?')[0]}`;
      const text = ad.text || ad.title || '';
      return `text:${text.slice(0, 80).trim()}`;
    };
    ads.forEach((ad) => {
      const key = getKey(ad);
      const arr = groupMap.get(key) ?? [];
      arr.push(ad);
      groupMap.set(key, arr);
    });
    groupMap.forEach((arr) => {
      const related = Math.max(0, arr.length - 1);
      arr.forEach(() => variationCounts.push(related));
    });
  } catch (e) {
    /* fall back silently */
  }
  const averageVariationCount =
    variationCounts.length > 0
      ? variationCounts.reduce((sum, v) => sum + v, 0) / variationCounts.length
      : 0;

  // Competitor breakdown
  const competitorCounts = new Map<string, number>();
  selectedCompetitors.forEach((comp) => {
    competitorCounts.set(comp, ads.filter((ad) => ad.page_name === comp).length);
  });

  const competitorBreakdown: CompetitorBreakdown[] = Array.from(competitorCounts.entries()).map(
    ([competitor, count]) => ({
      competitor,
      count,
      percentage: totalCreatives > 0 ? (count / totalCreatives) * 100 : 0,
    })
  );

  // Theme distribution
  const themeCounts = new Map<string, number>();
  ads.forEach((ad) => {
    const theme = ad.topic || ad.concept || 'Uncategorized';
    themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
  });

  const themeDistribution: DistributionItem[] = Array.from(themeCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalCreatives > 0 ? (count / totalCreatives) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Funnel distribution using extracted funnel URLs/paths
  const funnelCounts = new Map<string, number>();
  ads.forEach((ad) => {
    const funnels = extractFunnels(ad);
    if (funnels.length === 0) {
      funnelCounts.set('Unknown', (funnelCounts.get('Unknown') || 0) + 1);
    } else {
      funnels.forEach((f) => funnelCounts.set(f, (funnelCounts.get(f) || 0) + 1));
    }
  });

  const funnelDistribution: DistributionItem[] = Array.from(funnelCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalCreatives > 0 ? (count / totalCreatives) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Mechanic distribution (mock - based on hook/realisation)
  const mechanicCounts = new Map<string, number>();
  ads.forEach((ad) => {
    const mechanic = ad.hook || ad.realisation || 'Standard';
    mechanicCounts.set(mechanic, (mechanicCounts.get(mechanic) || 0) + 1);
  });

  const mechanicDistribution: DistributionItem[] = Array.from(mechanicCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalCreatives > 0 ? (count / totalCreatives) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Visual patterns (clustering based on image_description)
  const visualPatterns = clusterVisualPatterns(ads);

  // Format distribution
  const formatDistribution: FormatDistribution = {
    video: ads.filter((ad) => ad.display_format?.toLowerCase().includes('video')).length,
    static: ads.filter((ad) => ad.display_format?.toLowerCase().includes('image')).length,
    carousel: ads.filter((ad) => ad.display_format?.toLowerCase().includes('carousel')).length,
    other: ads.filter(
      (ad) =>
        !ad.display_format?.toLowerCase().includes('video') &&
        !ad.display_format?.toLowerCase().includes('image') &&
        !ad.display_format?.toLowerCase().includes('carousel')
    ).length,
  };

  // Duration distribution (mock - would need actual video duration data)
  const durationDistribution: DurationDistribution = {
    ranges: [
      { range: '0-15s', count: Math.floor(formatDistribution.video * 0.3) },
      { range: '15-30s', count: Math.floor(formatDistribution.video * 0.4) },
      { range: '30-45s', count: Math.floor(formatDistribution.video * 0.2) },
      { range: '45s+', count: Math.floor(formatDistribution.video * 0.1) },
    ],
    mostCommon: ['15s', '30s', '45s'],
  };

  // Character distribution (based on character field)
  const characterCounts = new Map<string, number>();
  ads.forEach((ad) => {
    if (ad.character) {
      characterCounts.set(ad.character, (characterCounts.get(ad.character) || 0) + 1);
    }
  });

  const characterDistribution: CharacterDistribution = {
    types: Array.from(characterCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    mostCommon:
      characterCounts.size > 0
        ? Array.from(characterCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : 'Unknown',
  };

  // Trends over time
  const trendsOverTime = calculateTrends(ads);

  return {
    totalCreatives,
    competitorBreakdown,
    averageVariationCount,
    funnelsUsed: funnelCounts.size,
    themesUsed: themeCounts.size,
    mechanicsUsed: mechanicCounts.size,
    themeDistribution,
    funnelDistribution,
    mechanicDistribution,
    visualPatterns,
    formatDistribution,
    durationDistribution,
    characterDistribution,
    trendsOverTime,
  };
}

function extractFunnels(ad: Ad): string[] {
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
      /* noop */
    }
  };
  addUrl(ad.link_url as string | undefined);
  addUrl((ad as unknown as { meta_ad_url?: string }).meta_ad_url);
  addUrl((ad as unknown as { duplicates_links?: string }).duplicates_links);
  if (ad.text) addUrl(ad.text);
  return Array.from(set);
}

function clusterVisualPatterns(ads: Ad[]): VisualPattern[] {
  // Simple clustering based on image descriptions
  const patterns = new Map<string, { descriptions: string[]; count: number; examples: string[] }>();

  ads.forEach((ad) => {
    if (ad.image_description) {
      // Simple keyword-based clustering
      let category = 'General';
      const desc = ad.image_description.toLowerCase();

      if (
        desc.includes('person') ||
        desc.includes('people') ||
        desc.includes('woman') ||
        desc.includes('man')
      ) {
        category = 'People-focused';
      } else if (desc.includes('product') || desc.includes('phone') || desc.includes('app')) {
        category = 'Product showcase';
      } else if (desc.includes('text') || desc.includes('typography')) {
        category = 'Text-heavy';
      } else if (desc.includes('before') && desc.includes('after')) {
        category = 'Before/After comparison';
      } else if (desc.includes('split') || desc.includes('comparison')) {
        category = 'Split-screen comparison';
      }

      if (!patterns.has(category)) {
        patterns.set(category, { descriptions: [], count: 0, examples: [] });
      }

      const pattern = patterns.get(category)!;
      pattern.count += 1;
      if (pattern.examples.length < 3) {
        const example = ad.page_name?.trim();
        if (example) pattern.examples.push(example);
      }
    }
  });

  return Array.from(patterns.entries()).map(([name, data], idx) => ({
    id: `pattern-${idx}`,
    name,
    description: `Creatives featuring ${name.toLowerCase()} visual style`,
    count: data.count,
    examples: data.examples,
  }));
}

function calculateTrends(ads: Ad[]): TrendsData {
  // Group ads by week
  const weeklyThemes = new Map<string, Map<string, number>>();
  const weeklyFunnels = new Map<string, Map<string, number>>();

  ads.forEach((ad) => {
    if (!ad.created_at) return;

    const date = new Date(ad.created_at);
    const weekKey = getWeekKey(date);

    // Themes
    const theme = ad.topic || ad.concept || 'Uncategorized';
    if (!weeklyThemes.has(weekKey)) {
      weeklyThemes.set(weekKey, new Map());
    }
    const weekThemes = weeklyThemes.get(weekKey)!;
    weekThemes.set(theme, (weekThemes.get(theme) || 0) + 1);

    // Funnels
    const funnel = ad.cta_type || 'Unknown';
    if (!weeklyFunnels.has(weekKey)) {
      weeklyFunnels.set(weekKey, new Map());
    }
    const weekFunnels = weeklyFunnels.get(weekKey)!;
    weekFunnels.set(funnel, (weekFunnels.get(funnel) || 0) + 1);
  });

  // Convert to time series format
  const themesOverTime: TimeSeriesData[] = Array.from(weeklyThemes.entries())
    .sort()
    .map(([date, themes]) => ({
      date,
      series: Array.from(themes.entries()).map(([name, value]) => ({ name, value })),
    }));

  const funnelsOverTime: TimeSeriesData[] = Array.from(weeklyFunnels.entries())
    .sort()
    .map(([date, funnels]) => ({
      date,
      series: Array.from(funnels.entries()).map(([name, value]) => ({ name, value })),
    }));

  // Calculate insights (compare last 30 days with previous period)
  const insights = calculateInsights(themesOverTime, ads);

  return {
    themesOverTime,
    funnelsOverTime,
    patternsOverTime: [],
    insights,
  };
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateInsights(
  themesOverTime: TimeSeriesData[],
  ads: Ad[]
): { increasing: string[]; decreasing: string[] } {
  const increasing: string[] = [];
  const decreasing: string[] = [];

  if (themesOverTime.length < 2) {
    return { increasing, decreasing };
  }

  // Get last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentAds = ads.filter((ad) => {
    if (!ad.created_at) return false;
    const adDate = new Date(ad.created_at);
    return adDate >= thirtyDaysAgo;
  });

  const olderAds = ads.filter((ad) => {
    if (!ad.created_at) return false;
    const adDate = new Date(ad.created_at);
    return adDate < thirtyDaysAgo;
  });

  // Compare theme frequencies
  const recentThemes = new Map<string, number>();
  const olderThemes = new Map<string, number>();

  recentAds.forEach((ad) => {
    const theme = ad.topic || ad.concept || 'Uncategorized';
    recentThemes.set(theme, (recentThemes.get(theme) || 0) + 1);
  });

  olderAds.forEach((ad) => {
    const theme = ad.topic || ad.concept || 'Uncategorized';
    olderThemes.set(theme, (olderThemes.get(theme) || 0) + 1);
  });

  recentThemes.forEach((recentCount, theme) => {
    const olderCount = olderThemes.get(theme) || 0;
    if (recentCount > olderCount * 1.5) {
      increasing.push(theme);
    } else if (olderCount > recentCount * 1.5) {
      decreasing.push(theme);
    }
  });

  return { increasing, decreasing };
}
