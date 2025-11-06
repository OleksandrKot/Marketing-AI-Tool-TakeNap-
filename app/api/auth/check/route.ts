import { NextResponse } from 'next/server';

// This API route relies on the incoming request URL / query and external
// service keys, so mark it as force-dynamic to avoid issues during static
// export. Next will treat it as a dynamic route and won't attempt to render
// it statically.
export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/supabase';

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return 'Unknown error';
  }
}

/* function getStringField(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === 'string' ? v : null;
} */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'email query required' }, { status: 400 });

    const supabase = createServerSupabaseClient();

    type ListUsersResponse = { error?: { message?: string } | null; data?: unknown };

    function getErrorMessage(e: unknown): string {
      if (e instanceof Error) return e.message;
      try {
        return String(e);
      } catch {
        return 'Unknown error';
      }
    }

    function getStringField(obj: unknown, key: string): string | null {
      if (!obj || typeof obj !== 'object') return null;
      const rec = obj as Record<string, unknown>;
      const v = rec[key];
      return typeof v === 'string' ? v : null;
    }

    // Prefer the GoTrue admin API if available on the client library
    const authObj = supabase.auth as unknown;
    const adminObj =
      authObj && typeof authObj === 'object' && 'admin' in (authObj as Record<string, unknown>)
        ? (authObj as Record<string, unknown>)['admin']
        : undefined;

    const hasListUsers = Boolean(
      adminObj &&
        typeof adminObj === 'object' &&
        'listUsers' in (adminObj as Record<string, unknown>)
    );

    if (hasListUsers) {
      const listFn = (adminObj as Record<string, unknown>)['listUsers'] as
        | ((opts?: { perPage?: number }) => Promise<ListUsersResponse>)
        | undefined;
      if (typeof listFn === 'function') {
        try {
          const res = await listFn({ perPage: 200 });
          if (res.error) {
            console.error('admin.listUsers error', res.error);
            return NextResponse.json(
              { error: res.error.message || String(res.error) },
              { status: 500 }
            );
          }
          const all =
            res.data &&
            typeof res.data === 'object' &&
            'users' in (res.data as Record<string, unknown>)
              ? ((res.data as Record<string, unknown>)['users'] as unknown[])
              : Array.isArray(res.data)
              ? (res.data as unknown[])
              : [];
          const found = (all || []).find(
            (u) => (getStringField(u, 'email') || '').toLowerCase() === email.toLowerCase()
          );
          return NextResponse.json({ exists: !!found });
        } catch (e: unknown) {
          console.error('admin.listUsers failed', e);
          // fallthrough to REST admin endpoint
        }
      }
    }

    // Fallback: call GoTrue Admin REST endpoint directly using service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars for auth check');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const adminUrl = `${supabaseUrl.replace(
      /\/$/,
      ''
    )}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
    try {
      const r = await fetch(adminUrl, { headers: { Authorization: `Bearer ${serviceKey}` } });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        console.error('GoTrue admin users request failed', r.status, text);
        return NextResponse.json({ error: `Admin lookup failed: ${r.status}` }, { status: 500 });
      }
      const payload = await r.json();
      const exists = Array.isArray(payload) ? payload.length > 0 : false;
      return NextResponse.json({ exists });
    } catch (e: unknown) {
      console.error('auth check REST error', e);
      return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
    }
  } catch (e: unknown) {
    console.error('auth check error', e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
