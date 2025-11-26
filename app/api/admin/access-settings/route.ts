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
    const resp = await client.from('access_settings').select('*').eq('id', 1).single();
    if (resp.error) {
      return NextResponse.json({ error: resp.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: resp.data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret') || '';
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (typeof body.auto_approve_new_users === 'boolean') {
      patch.auto_approve_new_users = body.auto_approve_new_users;
    }
    if (typeof body.is_beta_mode === 'boolean') {
      patch.is_beta_mode = body.is_beta_mode;
    }
    if (Array.isArray(body.allowed_domains)) {
      patch.allowed_domains = body.allowed_domains;
    }
    if (Array.isArray(body.blocked_domains)) {
      patch.blocked_domains = body.blocked_domains;
    }
    if (typeof body.notify_on_new_pending === 'boolean') {
      patch.notify_on_new_pending = body.notify_on_new_pending;
    }
    if (typeof body.notify_on_approve === 'boolean') {
      patch.notify_on_approve = body.notify_on_approve;
    }
    if (typeof body.notify_on_block === 'boolean') {
      patch.notify_on_block = body.notify_on_block;
    }
    if (typeof body.max_approved_users === 'number' || body.max_approved_users === null) {
      patch.max_approved_users = body.max_approved_users;
    }

    patch.updated_at = new Date().toISOString();

    const client = createServerSupabaseClient();
    const resp = await client
      .from('access_settings')
      .upsert({ id: 1, ...patch }, { onConflict: 'id' })
      .select('*')
      .single();

    if (resp.error) {
      return NextResponse.json({ error: resp.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: resp.data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
