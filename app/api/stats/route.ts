import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

// GET - отримати статистику
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Загальна кількість креативів
    const { count: totalAds } = await supabase
      .from('ads_library')
      .select('*', { count: 'exact', head: true });

    // Кількість відео креативів
    const { count: videoAds } = await supabase
      .from('ads_library')
      .select('*', { count: 'exact', head: true })
      .eq('display_format', 'VIDEO');

    // Унікальні сторінки
    const { data: pages } = await supabase
      .from('ads_library')
      .select('page_name')
      .not('page_name', 'is', null);

    const uniquePages = [...new Set(pages?.map((p) => p.page_name) || [])];

    // Креативи за останні 30 днів
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: recentAds } = await supabase
      .from('ads_library')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    return NextResponse.json({
      totalAds: totalAds || 0,
      videoAds: videoAds || 0,
      imageAds: (totalAds || 0) - (videoAds || 0),
      uniquePages: uniquePages.length,
      recentAds: recentAds || 0,
      platforms: uniquePages,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
