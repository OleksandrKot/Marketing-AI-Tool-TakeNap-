import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

const ADMIN_SECRET = process.env.ACCESS_REQUESTS_ADMIN_SECRET || process.env.ADMIN_SECRET || '';

export async function GET(req: Request) {
  const secret = req.headers.get('x-admin-secret') || '';
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = createServerSupabaseClient();

    // Fetch admin/blocked flags from user_admins
    const adminsResp = await client.from('user_admins').select('user_id,email,is_admin,is_blocked');
    const adminsError = (adminsResp as unknown as { error?: { message?: string } }).error;
    if (adminsError) {
      return NextResponse.json(
        { error: adminsError.message || 'Failed to load admin flags' },
        { status: 500 }
      );
    }

    const admins = ((adminsResp as unknown as { data?: unknown }).data || []) as Array<{
      user_id: string | null;
      email: string | null;
      is_admin?: boolean | null;
      is_blocked?: boolean | null;
    }>;

    // Fetch auth users via GoTrue admin REST API using service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set' },
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
      console.error('GoTrue admin users request failed', r.status, text);
      return NextResponse.json({ error: `Admin request failed: ${r.status}` }, { status: 500 });
    }
    const payload = await r.json();
    const users = Array.isArray(payload) ? payload : [];

    const adminByEmail: Record<string, { is_admin?: boolean | null; is_blocked?: boolean | null }> =
      {};
    for (const a of admins) {
      if (a && a.email) adminByEmail[a.email.toLowerCase()] = a;
    }

    const merged = (users as unknown[]).map((u) => {
      const rec = (u as Record<string, unknown> | null) ?? null;
      const id = rec && 'id' in rec ? (rec['id'] as string | undefined) : undefined;
      const email = rec && 'email' in rec ? (rec['email'] as string | null | undefined) : undefined;
      const created_at =
        rec && 'created_at' in rec ? (rec['created_at'] as string | null | undefined) : undefined;

      const key = (email || '').toLowerCase();
      const flags = key ? adminByEmail[key] || null : null;

      return {
        id,
        email,
        created_at,
        is_admin: !!flags?.is_admin,
        is_blocked: !!flags?.is_blocked,
      };
    });

    return NextResponse.json({ ok: true, data: merged });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
