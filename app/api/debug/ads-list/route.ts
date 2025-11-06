import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('ads_library')
      .select('id, ad_archive_id, created_at, page_name, publisher_platform')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return new Response(JSON.stringify({ success: false, error }), { status: 500 });

    return new Response(JSON.stringify({ success: true, count: (data || []).length, rows: data }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500 });
  }
}
