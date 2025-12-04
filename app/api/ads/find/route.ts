import { createServerSupabaseClient } from '@/lib/core/supabase';
import { NextResponse } from 'next/server';

// This route reads `request.url` for query params which forces dynamic
// server usage. Explicitly opt into dynamic rendering to avoid the
// Next.js static-render error.
export const dynamic = 'force-dynamic';

type AdRow = { id: number | string; ad_archive_id?: string | null; [k: string]: unknown };

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const url = new URL(request.url);
    const term = (url.searchParams.get('term') || '').trim();

    if (!term) return NextResponse.json({ error: 'term required' }, { status: 400 });

    // try numeric id match first
    const asNum = Number(term);
    let rows: AdRow[] = [];

    if (!Number.isNaN(asNum)) {
      const { data, error } = await supabase
        .from('ads_library')
        .select('*')
        .or(`id.eq.${asNum},ad_archive_id.eq.${encodeURIComponent(term)}`)
        .limit(200);
      if (error) {
        console.error('Error in /api/ads/find (numeric)', error);
        return NextResponse.json({ error: 'DB error' }, { status: 502 });
      }
      rows = Array.isArray(data) ? (data as AdRow[]) : [];
    } else {
      const { data, error } = await supabase
        .from('ads_library')
        .select('*')
        .or(
          `ad_archive_id.eq.${encodeURIComponent(term)},page_name.ilike.%${encodeURIComponent(
            term
          )}%`
        )
        .limit(200);
      if (error) {
        console.error('Error in /api/ads/find (text)', error);
        return NextResponse.json({ error: 'DB error' }, { status: 502 });
      }
      rows = Array.isArray(data) ? (data as AdRow[]) : [];
    }

    return NextResponse.json({ count: rows.length, rows });
  } catch (err) {
    console.error('Unexpected error in /api/ads/find:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
