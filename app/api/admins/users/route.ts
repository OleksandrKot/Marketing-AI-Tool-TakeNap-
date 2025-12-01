import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function GET() {
  try {
    const client = createServerSupabaseClient();

    // Auto-sync: fill missing user_id in `user_admins` by looking up auth.users
    try {
      const pendingResp = await client.from('user_admins').select('email').is('user_id', null);
      const pending = Array.isArray(pendingResp.data)
        ? (pendingResp.data as Array<Record<string, unknown>>)
        : [];
      for (const row of pending) {
        const email = String(row?.email ?? '');
        if (!email) continue;
        try {
          const lookup = await client.from('auth.users').select('id').eq('email', email).single();
          const uid =
            lookup.data && typeof lookup.data === 'object'
              ? (lookup.data as { id?: string }).id
              : undefined;
          if (uid) {
            await client.from('user_admins').update({ user_id: uid }).eq('email', email).select();
          }
        } catch (e) {
          // ignore lookup failure
        }
      }
    } catch (e) {
      // ignore sync errors; proceed to build users list
    }

    // Fetch admin/blocked flags from user_admins
    const adminsResp = await client.from('user_admins').select('user_id,email,is_admin,is_blocked');
    if (adminsResp.error) {
      return NextResponse.json(
        { error: adminsResp.error.message || 'Failed to load admin flags' },
        { status: 500 }
      );
    }

    const admins = (adminsResp.data || []) as Array<{
      user_id: string | null;
      email: string | null;
      is_admin?: boolean | null;
      is_blocked?: boolean | null;
    }>;

    // Fetch approved access requests (by email) so we can limit results to approved users
    const approvedResp = await client
      .from('access_requests')
      .select('email')
      .eq('status', 'approved');
    if (approvedResp.error) {
      return NextResponse.json(
        { error: approvedResp.error.message || 'Failed to load approved access requests' },
        { status: 500 }
      );
    }
    const approved = (approvedResp.data || []) as Array<{ email?: string | null }>;
    const approvedByEmail = new Set(approved.map((p) => (p.email || '').toString().toLowerCase()));

    // Try to fetch auth users via PostgREST using the server client (service role).
    // In some Supabase setups the `auth` schema is not exposed to PostgREST, so fall back
    // to the GoTrue admin REST endpoint when necessary.
    let users: Array<{ id?: string; email?: string | null; created_at?: string | null }> = [];
    try {
      const { data: authUsers, error: authErr } = await client
        .from('auth.users')
        .select('id,email,created_at');
      if (authErr) throw authErr;
      users = (authUsers || []) as Array<{
        id?: string;
        email?: string | null;
        created_at?: string | null;
      }>;
    } catch (err) {
      // If PostgREST can't see auth.users, fall back to the GoTrue admin API
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey) {
        return NextResponse.json(
          {
            error: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set',
          },
          { status: 500 }
        );
      }

      const adminUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`;
      const r = await fetch(adminUrl, {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        console.error('GoTrue admin users request failed', r.status, text, err);
        return NextResponse.json({ error: `Admin request failed: ${r.status}` }, { status: 500 });
      }
      const payload = await r.json();
      // GoTrue admin returns { users: [...] } — accept either shape
      if (Array.isArray(payload)) {
        users = payload as Array<{
          id?: string;
          email?: string | null;
          created_at?: string | null;
        }>;
      } else if (
        payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as Record<string, unknown>)['users'])
      ) {
        users = (payload as Record<string, unknown>)['users'] as unknown[] as Array<{
          id?: string;
          email?: string | null;
          created_at?: string | null;
        }>;
      } else {
        users = [];
      }
    }

    const adminByEmail: Record<string, { is_admin?: boolean | null; is_blocked?: boolean | null }> =
      {};
    for (const a of admins) {
      if (a && a.email) adminByEmail[a.email.toLowerCase()] = a;
    }

    // Build a map of auth users by lowercased email for quick lookup
    const authByEmail: Record<
      string,
      {
        id?: string | undefined;
        email?: string | null | undefined;
        created_at?: string | null | undefined;
      }
    > = {};
    for (const u of users) {
      const rec = (u as { id?: string; email?: string | null; created_at?: string | null }) ?? null;
      const email = rec?.email;
      const id = rec?.id;
      const created_at = rec?.created_at;
      if (email) authByEmail[(email || '').toLowerCase()] = { id, email, created_at };
    }

    const results: Array<Record<string, unknown>> = [];

    // For every approved email, include either the registered auth user or a placeholder marked not_registered
    for (const email of Array.from(approvedByEmail)) {
      const key = (email || '').toLowerCase();
      const auth = authByEmail[key] || null;
      const flags = key ? adminByEmail[key] || null : null;

      if (auth && auth.id) {
        results.push({
          id: auth.id,
          email: auth.email,
          created_at: auth.created_at,
          is_admin: !!flags?.is_admin,
          is_blocked: !!flags?.is_blocked,
          not_registered: false,
        });
      } else {
        results.push({
          id: '',
          email: key,
          created_at: null,
          is_admin: !!flags?.is_admin,
          is_blocked: !!flags?.is_blocked,
          not_registered: true,
        });
      }
    }

    return NextResponse.json({ ok: true, data: results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
