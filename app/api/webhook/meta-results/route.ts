import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/supabase';

// Webhook для отримання результатів від Make.com
export async function POST(request: NextRequest) {
  try {
    // Перевірка API ключа
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.MAKE_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ads_data } = await request.json();
    const supabase = createServerSupabaseClient();

    // Збереження всіх знайдених креативів
    const results = [];

    for (const adData of ads_data) {
      const { data, error } = await supabase
        .from('ads_library')
        .insert([
          {
            ad_archive_id: adData.ad_archive_id,
            page_name: adData.page_name,
            text: adData.ad_text,
            caption: adData.ad_caption,
            cta_text: adData.cta_text,
            cta_type: adData.cta_type,
            display_format: adData.media_type,
            link_url: adData.link_url,
            title: adData.ad_title,
            video_hd_url: adData.video_url,
            video_preview_image: adData.image_url,
            publisher_platform: 'Facebook',
          },
        ])
        .select()
        .single();

      if (!error) {
        results.push(data);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${results.length} ads`,
      imported_ads: results.length,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
