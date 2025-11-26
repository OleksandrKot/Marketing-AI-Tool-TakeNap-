import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

const ADMIN_SECRET = process.env.ACCESS_REQUESTS_ADMIN_SECRET || process.env.ADMIN_SECRET || '';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email || '').toString().trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const client = createServerSupabaseClient();

    const insertResp = await client
      .from('access_requests')
      .insert({ email, status: 'pending' })
      .select();
    if (insertResp.error) {
      return NextResponse.json({ error: insertResp.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: insertResp.data?.[0] || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Admin listing: protect with simple header check
  const secret = req.headers.get('x-admin-secret') || '';
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = createServerSupabaseClient();
    const resp = await client
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (resp.error) return NextResponse.json({ error: resp.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: resp.data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
