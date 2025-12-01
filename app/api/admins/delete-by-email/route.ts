import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email || '').toString();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const client = createServerSupabaseClient();

    // Remove from access_requests (approved list)
    await client.from('access_requests').delete().eq('email', email);

    // Remove any user_admins entry for that email
    await client.from('user_admins').delete().eq('email', email);

    // Return success
    return NextResponse.json({ ok: true, data: { email } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
