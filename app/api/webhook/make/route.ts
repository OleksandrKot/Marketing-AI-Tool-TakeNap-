import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/supabase';

// Webhook для Make.com
export async function POST(request: NextRequest) {
  try {
    // Перевірка API ключа (додайте в .env)
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.MAKE_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    const supabase = createServerSupabaseClient();

    switch (action) {
      case 'create_ad':
        const { data: newAd, error: createError } = await supabase
          .from('ads_library')
          .insert([data])
          .select()
          .single();

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Ad created successfully',
          data: newAd,
        });

      case 'update_ad':
        const { id, ...updateData } = data;
        const { data: updatedAd, error: updateError } = await supabase
          .from('ads_library')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Ad updated successfully',
          data: updatedAd,
        });

      case 'get_ads':
        const { data: ads, error: getError } = await supabase
          .from('ads_library')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(data.limit || 100);

        if (getError) {
          return NextResponse.json({ error: getError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: ads,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
