import { createServerSupabaseClient } from '@/lib/core/supabase';
import { NextResponse } from 'next/server';

type AdRow = {
  id: number | string;
  ad_archive_id?: string | null;
  created_at?: string | null;
  page_name?: string | null;
};

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // total rows (exact)
    const { count: totalCount, error: totalErr } = await supabase
      .from('ads_library')
      .select('*', { count: 'exact', head: true });

    if (totalErr) {
      console.error('Error fetching total count for ads (debug):', totalErr);
      return NextResponse.json({ error: 'Failed to fetch total count' }, { status: 502 });
    }

    const total_rows = typeof totalCount === 'number' ? totalCount : 0;

    // fetch ad_archive_id list
    const { data: idRows, error: idErr } = await supabase
      .from('ads_library')
      .select('id, ad_archive_id, created_at, page_name');
    if (idErr) {
      console.error('Error fetching ad_archive_id list for debug:', idErr);
      return NextResponse.json({ error: 'Failed to fetch id list' }, { status: 502 });
    }

    const rows: AdRow[] = Array.isArray(idRows) ? idRows : [];
    const distinct_ad_archive_id = new Set(
      rows
        .map((r) => (r && r.ad_archive_id != null ? String(r.ad_archive_id) : null))
        .filter(Boolean)
    );

    const nullAdArchive = rows.filter((r) => r.ad_archive_id == null).length;

    // find mismatches where id !== ad_archive_id (may indicate different sources)
    const mismatches = rows
      .filter((r) => r && r.ad_archive_id != null && String(r.id) !== String(r.ad_archive_id))
      .slice(0, 50);

    return NextResponse.json({
      total_rows,
      distinct_ad_archive_id: distinct_ad_archive_id.size,
      null_ad_archive_count: nullAdArchive,
      sample_distinct_ad_archive_ids: Array.from(distinct_ad_archive_id).slice(0, 200),
      sample_mismatches: mismatches,
      sample_rows: rows.slice(0, 200),
    });
  } catch (err) {
    console.error('Unexpected error in /api/ads/debug:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
