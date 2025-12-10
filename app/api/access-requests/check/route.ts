import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get('email') || '').toString().trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  try {
    const client = createServerSupabaseClient();
    const resp = await client
      .from('access_requests')
      .select('status')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (resp.error && (resp.error as unknown as { code?: string }).code !== 'PGRST116') {
      return NextResponse.json({ error: resp.error.message }, { status: 500 });
    }

    const isApproved = resp.data?.status === 'approved';
    const isPending = resp.data?.status === 'pending';
    return NextResponse.json({ ok: true, approved: !!isApproved, pending: !!isPending });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
