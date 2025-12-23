import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/core/supabase';

// GET /api/ads/cards/[ad_archive_id]
export async function GET(_req: NextRequest, { params }: { params: { ad_archive_id: string } }) {
  try {
    const ad_archive_id = params?.ad_archive_id;
    if (!ad_archive_id) {
      return NextResponse.json({ error: 'ad_archive_id is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('ad_cards')
      .select('ad_archive_id, card_index, storage_bucket, storage_path, source_url, created_at')
      .eq('ad_archive_id', ad_archive_id)
      .order('card_index', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
