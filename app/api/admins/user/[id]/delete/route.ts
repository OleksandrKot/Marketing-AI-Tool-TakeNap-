import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

const ADMIN_SECRET = process.env.ACCESS_REQUESTS_ADMIN_SECRET || process.env.ADMIN_SECRET || '';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const secret = req.headers.get('x-admin-secret') || '';
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const client = createServerSupabaseClient();
    // Try to delete from auth.users via PostgREST
    const resp = await client.from('auth.users').delete().eq('id', id).select();
    const respError = (resp as unknown as { error?: { message?: string }; data?: unknown }).error;
    if (respError)
      return NextResponse.json({ error: respError.message || 'Delete failed' }, { status: 500 });
    const dataArr = (resp as unknown as { data?: unknown }).data as unknown[] | undefined;
    return NextResponse.json({ ok: true, data: dataArr?.[0] || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
