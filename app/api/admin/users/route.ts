import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/core/supabase';

type ListUsersResponse = {
  error?: { message?: string } | null;
  data?: unknown;
};

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

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    const email = request.nextUrl?.searchParams?.get('email') || null;

    let users: unknown[] = [];

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
        const res = await listFn({ perPage: 200 });
        if (res.error)
          return NextResponse.json({ error: res.error.message || 'Unknown' }, { status: 500 });
        let all: unknown[] = [];
        if (
          res.data &&
          typeof res.data === 'object' &&
          'users' in (res.data as Record<string, unknown>)
        ) {
          all = ((res.data as Record<string, unknown>)['users'] as unknown[]) || [];
        } else if (Array.isArray(res.data)) {
          all = res.data as unknown[];
        }
        users = all;
        if (email) {
          const found = all.find(
            (u) => (getStringField(u, 'email') || '').toLowerCase() === email.toLowerCase()
          );
          if (found) users = [found];
        }
      }
    } else {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey)
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
      const adminUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users${
        email ? `?email=${encodeURIComponent(email)}` : ''
      }`;
      try {
        const r = await fetch(adminUrl, { headers: { Authorization: `Bearer ${serviceKey}` } });
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          console.error('GoTrue admin users request failed', r.status, text);
          return NextResponse.json({ error: `Admin request failed: ${r.status}` }, { status: 500 });
        }
        const payload = await r.json();
        users = Array.isArray(payload) ? payload : [];
      } catch (e: unknown) {
        console.error('admin users REST error', e);
        return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
      }
    }

    const mapped = users.map((u) => {
      const id = getStringField(u, 'id');
      const emailField = getStringField(u, 'email');
      const userMeta = (
        u && typeof u === 'object' ? (u as Record<string, unknown>)['user_metadata'] : undefined
      ) as Record<string, unknown> | undefined;
      const rawMeta = (
        u && typeof u === 'object'
          ? (u as Record<string, unknown>)['raw_user_meta_data']
          : undefined
      ) as Record<string, unknown> | undefined;
      const display_name =
        (userMeta &&
          typeof userMeta === 'object' &&
          typeof userMeta['display_name'] === 'string' &&
          (userMeta['display_name'] as string)) ||
        (rawMeta &&
          typeof rawMeta === 'object' &&
          typeof rawMeta['display_name'] === 'string' &&
          (rawMeta['display_name'] as string)) ||
        null;
      return {
        id: id ?? undefined,
        email: emailField ?? undefined,
        display_name,
      };
    });

    return NextResponse.json({ users: mapped });
  } catch (e: unknown) {
    console.error('admin users list error', e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
