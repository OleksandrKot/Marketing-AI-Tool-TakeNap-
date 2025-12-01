import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    const client = createServerSupabaseClient();
    const resp = await client
      .from('access_requests')
      .update({ status: 'approved' })
      .eq('id', id)
      .select();
    if (resp.error) return NextResponse.json({ error: resp.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: resp.data?.[0] || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
