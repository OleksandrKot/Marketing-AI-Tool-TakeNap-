import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ADMIN_SECRET = process.env.ACCESS_REQUESTS_ADMIN_SECRET || process.env.ADMIN_SECRET || '';

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
    const secret = request.headers.get('x-admin-secret') || '';
    if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = request.nextUrl?.searchParams?.get('email') || null;

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set' },
        { status: 500 }
      );
    }

    const adminUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users${
      email ? `?email=${encodeURIComponent(email)}` : ''
    }`;

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
    let users: unknown[] = [];
    if (Array.isArray(payload)) {
      users = payload as unknown[];
    } else if (
      payload &&
      typeof payload === 'object' &&
      'users' in (payload as Record<string, unknown>) &&
      Array.isArray((payload as Record<string, unknown>).users)
    ) {
      users = (payload as { users: unknown[] }).users;
    }

    const mapped = users.map((u) => {
      const id = getStringField(u, 'id');
      const emailField = getStringField(u, 'email');
      const createdAt = getStringField(u, 'created_at');
      return {
        id: id ?? undefined,
        email: emailField ?? undefined,
        created_at: createdAt ?? undefined,
      };
    });

    return NextResponse.json({ users: mapped });
  } catch (e: unknown) {
    console.error('admin users list error', e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
