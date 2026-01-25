import { createServerSupabaseClient } from '@/lib/core/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // total rows (exact)
    const { count: totalCount, error: totalErr } = await supabase
      .from('ads')
      .select('*', { count: 'exact', head: true });

    if (totalErr) {
      console.error('Error fetching total count for ads:', totalErr);
      return NextResponse.json({ error: 'Failed to fetch head' }, { status: 502 });
    }

    const total_rows = typeof totalCount === 'number' ? totalCount : 0;

    // (skipping not-deleted and latest-created checks for a minimal head response)

    // distinct ad_archive_id count (fetching ids and deduping server-side)
    const { data: idRows, error: idErr } = await supabase.from('ads').select('ad_archive_id');
    if (idErr) {
      console.error('Error fetching ad_archive_id list for distinct count:', idErr);
      return NextResponse.json({ error: 'Failed to fetch head' }, { status: 502 });
    }
    type IdRow = { ad_archive_id?: string | number | null };
    const distinct_ad_archive_id = Array.isArray(idRows)
      ? new Set(
          (idRows as IdRow[])
            .map((r) => (r && r.ad_archive_id != null ? String(r.ad_archive_id) : null))
            .filter(Boolean)
        ).size
      : 0;

    // Simplified counts: how many distinct ads we have (present) and how many are missing
    const present = distinct_ad_archive_id;
    const missing = Math.max(0, total_rows - distinct_ad_archive_id);

    // Server-side debug log (this will appear in your terminal)
    console.log('[Head Debug]', { present, missing });

    return NextResponse.json({ present, missing });
  } catch (err) {
    console.error('Unexpected error in /api/ads/head:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
