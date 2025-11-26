import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

const ADMIN_SECRET = process.env.ACCESS_REQUESTS_ADMIN_SECRET || process.env.ADMIN_SECRET || '';

export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret') || '';
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const email = (body?.email || '').toString();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const client = createServerSupabaseClient();
    const resp = await client.from('user_admins').delete().eq('email', email).select();
    if (resp.error) return NextResponse.json({ error: resp.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: resp.data?.[0] || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
