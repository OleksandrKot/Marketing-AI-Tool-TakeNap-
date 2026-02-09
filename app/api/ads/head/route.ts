import { createServerSupabaseClient } from '@/lib/core/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Simple count without expensive distinct calculation
    const { count: totalCount, error: totalErr } = await supabase
      .from('ads')
      .select('*', { count: 'exact', head: true });

    if (totalErr) {
      console.error('Error fetching total count for ads:', totalErr);
      return NextResponse.json({ error: 'Failed to fetch head' }, { status: 502 });
    }

    const total_rows = typeof totalCount === 'number' ? totalCount : 0;

    // Return simplified response (no expensive distinct calculation)
    return NextResponse.json({
      present: total_rows,
      missing: 0,
      total: total_rows,
    });
  } catch (err) {
    console.error('Unexpected error in /api/ads/head:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
