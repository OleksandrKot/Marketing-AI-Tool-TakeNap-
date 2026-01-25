import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/core/supabase';

// GET /api/ads/cards/[ad_archive_id]
// GET /api/ads/cards/[ad_archive_id]?businessId=...
export async function GET(req: NextRequest, { params }: { params: { ad_archive_id: string } }) {
  try {
    const ad_archive_id = params?.ad_archive_id;
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    const supabase = createServerSupabaseClient();

    let query = supabase.from('ads').select('cards_json').eq('ad_archive_id', ad_archive_id);

    // If businessId exists, query will run instantly via index
    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query.single();

    if (error || !data?.cards_json) {
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: data.cards_json });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
