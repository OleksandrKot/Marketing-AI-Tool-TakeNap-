import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Use head:true and count: 'exact' to get counts without fetching all rows
    const qTotal = await supabase.from('ads_library').select('id', { head: true, count: 'exact' });
    const qWithPlatform = await supabase
      .from('ads_library')
      .select('id', { head: true, count: 'exact' })
      .not('publisher_platform', 'is', null);
    const qWithPageNameNull = await supabase
      .from('ads_library')
      .select('id', { head: true, count: 'exact' })
      .is('page_name', null);
    const qVideo = await supabase
      .from('ads_library')
      .select('id', { head: true, count: 'exact' })
      .eq('display_format', 'VIDEO');
    const qImage = await supabase
      .from('ads_library')
      .select('id', { head: true, count: 'exact' })
      .eq('display_format', 'IMAGE');

    const result = {
      total: qTotal.count ?? null,
      with_publisher_platform: qWithPlatform.count ?? null,
      page_name_null: qWithPageNameNull.count ?? null,
      video: qVideo.count ?? null,
      image: qImage.count ?? null,
    };
    console.log('Ads count result:', result);
    return new Response(JSON.stringify({ success: true, result }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500 });
  }
}
