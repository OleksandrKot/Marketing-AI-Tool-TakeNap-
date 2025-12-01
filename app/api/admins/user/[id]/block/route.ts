import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const client = createServerSupabaseClient();
    // Lookup user's email
    const uresp = await client.from('auth.users').select('email').eq('id', id).single();
    const email = (uresp as unknown as { data?: unknown })?.data as
      | Record<string, unknown>
      | undefined;
    const emailStr = email ? (email['email'] as string | undefined) : undefined;
    if (!emailStr) return NextResponse.json({ error: 'User email not found' }, { status: 404 });

    // Upsert into user_admins to set is_blocked = true
    const up = await client
      .from('user_admins')
      .upsert({ user_id: id, email, is_admin: false, is_blocked: true }, { onConflict: 'email' })
      .select();
    const upErr = (up as unknown as { error?: { message?: string }; data?: unknown }).error;
    if (upErr)
      return NextResponse.json({ error: upErr.message || 'Failed to block user' }, { status: 500 });
    const upData = (up as unknown as { data?: unknown }).data as unknown[] | undefined;
    return NextResponse.json({ ok: true, data: upData?.[0] || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
