import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST() {
  try {
    const client = createServerSupabaseClient();

    // Find records that are missing user_id
    const pendingResp = await client.from('user_admins').select('email').is('user_id', null);
    const pending = Array.isArray(pendingResp.data)
      ? (pendingResp.data as Array<Record<string, unknown>>)
      : [];

    let updated = 0;
    const details: Array<{ email: string; user_id?: string | null }> = [];

    for (const row of pending) {
      const email = String(row?.email ?? '');
      if (!email) continue;
      try {
        const lookup = await client.from('auth.users').select('id').eq('email', email).single();
        const uid =
          lookup && lookup.data && typeof lookup.data === 'object'
            ? ((lookup.data as Record<string, unknown>)['id'] as string | undefined)
            : undefined;
        if (uid) {
          const up = await client
            .from('user_admins')
            .update({ user_id: uid })
            .eq('email', email)
            .select();
          if (!up.error) {
            updated += 1;
            details.push({ email, user_id: uid });
          } else {
            details.push({ email, user_id: null });
          }
        } else {
          details.push({ email, user_id: null });
        }
      } catch (e) {
        details.push({ email, user_id: null });
      }
    }

    return NextResponse.json({ ok: true, attempted: pending.length, updated, details });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
