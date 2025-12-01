import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const client = createServerSupabaseClient();
    const insertResp = await client
      .from('access_requests')
      .insert({ email, status: 'pending' })
      .select();

    if (insertResp.error) {
      return NextResponse.json({ error: insertResp.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: insertResp.data?.[0] ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const client = createServerSupabaseClient();
    const resp = await client
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (resp.error) {
      return NextResponse.json({ error: resp.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: resp.data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
