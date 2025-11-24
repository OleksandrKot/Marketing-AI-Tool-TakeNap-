import { type NextRequest, NextResponse } from 'next/server';

// This API route depends on request URL search params and runtime database access.
// Mark as dynamic so Next won't attempt to render it statically during export.
export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/core/supabase';

// GET - отримати список креативів
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get('limit') || '50');
    const offset = Number.parseInt(searchParams.get('offset') || '0');
    const page_name = searchParams.get('page_name');
    const display_format = searchParams.get('display_format');

    const supabase = createServerSupabaseClient();

    let query = supabase
      .from('ads_library')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (page_name) {
      query = query.eq('page_name', page_name);
    }

    if (display_format) {
      query = query.eq('display_format', display_format);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - створити новий креатив
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.from('ads_library').insert([body]).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
