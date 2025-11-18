import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { log } from '@/lib/logger';

// POST /api/personas/share
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { persona, owner_user_id } = body || {};
    if (!persona) return NextResponse.json({ error: 'missing persona' }, { status: 400 });

    const token = Math.random().toString(36).substring(2, 9) + Date.now().toString(36).slice(-4);

    const supabase = createServerSupabaseClient();
    const insert = {
      token,
      owner_user_id: owner_user_id || null,
      persona,
    };

    const { error } = await supabase.from('shared_personas').insert([insert]);
    if (error) {
      log.error('[share] insert error', error);
      return NextResponse.json({ error: 'db insert failed' }, { status: 500 });
    }

    return NextResponse.json({ token });
  } catch (e) {
    log.error('[share] handler error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
