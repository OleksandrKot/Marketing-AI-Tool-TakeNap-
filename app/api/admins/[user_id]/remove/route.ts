import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

const ADMIN_SECRET = process.env.ACCESS_REQUESTS_ADMIN_SECRET || process.env.ADMIN_SECRET || '';

export async function POST(req: Request, { params }: { params: { user_id: string } }) {
  const secret = req.headers.get('x-admin-secret') || '';
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user_id = params.user_id;
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const client = createServerSupabaseClient();
    const resp = await client.from('user_admins').delete().eq('user_id', user_id).select();
    if (resp.error) return NextResponse.json({ error: resp.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: resp.data?.[0] || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
