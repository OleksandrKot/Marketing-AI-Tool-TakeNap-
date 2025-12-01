import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email || '').toString();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const client = createServerSupabaseClient();
    const resp = await client
      .from('user_admins')
      .upsert({ user_id: null, email, is_admin: false, is_blocked: true }, { onConflict: 'email' })
      .select();
    if (resp.error) return NextResponse.json({ error: resp.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: resp.data?.[0] || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
