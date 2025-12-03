import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const client = createServerSupabaseClient();

    const user_id = (url.searchParams.get('user_id') || '').toString();
    const email = (url.searchParams.get('email') || '').toString().toLowerCase();

    // Prefer checking by user_id when provided
    if (user_id) {
      const resp = await client
        .from('user_admins')
        .select('is_admin')
        .eq('user_id', user_id)
        .single();
      if (!resp.error && resp.data) {
        return NextResponse.json({ ok: true, is_admin: !!resp.data.is_admin });
      }

      // If not found by user_id, try to resolve the user's email and check by email
      try {
        const uresp = await client.from('auth.users').select('email').eq('id', user_id).single();
        const foundEmail =
          uresp && uresp.data && typeof uresp.data === 'object' && 'email' in uresp.data
            ? String((uresp.data as Record<string, unknown>)['email'] ?? '')
            : '';
        if (foundEmail) {
          const byEmail = await client
            .from('user_admins')
            .select('is_admin')
            .eq('email', foundEmail.toLowerCase())
            .single();
          if (!byEmail.error && byEmail.data) {
            return NextResponse.json({ ok: true, is_admin: !!byEmail.data.is_admin });
          }
        }
        // If an email query param was provided, also try checking by that email as a fallback
        if (email) {
          const byEmailParam = await client
            .from('user_admins')
            .select('is_admin')
            .eq('email', email.toLowerCase())
            .single();
          if (!byEmailParam.error && byEmailParam.data) {
            return NextResponse.json({ ok: true, is_admin: !!byEmailParam.data.is_admin });
          }
        }
      } catch (e) {
        // ignore lookup errors
      }

      return NextResponse.json({ ok: true, is_admin: false });
    }

    // If email param provided, check by email
    if (email) {
      const resp = await client.from('user_admins').select('is_admin').eq('email', email).single();
      if (resp.error) {
        const errObj = resp.error as unknown as Record<string, unknown>;
        const code =
          errObj && typeof errObj === 'object' ? (errObj['code'] as string | undefined) : undefined;
        if (code !== 'PGRST116') {
          return NextResponse.json({ error: resp.error.message }, { status: 500 });
        }
      }
      return NextResponse.json({ ok: true, is_admin: !!resp.data?.is_admin });
    }

    return NextResponse.json({ error: 'user_id or email required' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
