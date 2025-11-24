import { createServerSupabaseClient } from '@/lib/core/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Get exact count and latest created_at
    const {
      data: rows,
      count,
      error,
    } = await supabase
      .from('ads_library')
      .select('created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching head for ads:', error);
      return NextResponse.json({ error: 'Failed to fetch head' }, { status: 502 });
    }

    const latest = Array.isArray(rows) && rows.length > 0 ? rows[0].created_at : null;

    return NextResponse.json({ count: count ?? 0, latest_created_at: latest });
  } catch (err) {
    console.error('Unexpected error in /api/ads/head:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
