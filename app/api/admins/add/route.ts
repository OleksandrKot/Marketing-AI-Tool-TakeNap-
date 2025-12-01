import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let user_id = (body?.user_id || '').toString();
    const email = (body?.email || '').toString();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const client = createServerSupabaseClient();

    // Attempt to look up the user in auth.users by email so we can store user_id
    try {
      const lookup = await client.from('auth.users').select('id').eq('email', email).single();
      if (!lookup.error && lookup.data) {
        const idVal = (lookup.data as Record<string, unknown>)['id'] as string | undefined;
        if (idVal) user_id = idVal;
      }
    } catch (e) {
      // ignore lookup failure
    }

    // Upsert by email (email is UNIQUE) and include user_id if we found it. This ensures
    // rows created by email before registration will be updated to include user_id once available.
    const resp = await client
      .from('user_admins')
      .upsert({ user_id: user_id || null, email, is_admin: true }, { onConflict: 'email' })
      .select();
    if (resp.error) return NextResponse.json({ error: resp.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: resp.data?.[0] || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
