import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';
import { log } from '@/lib/core/logger';

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('shared_personas')
      .select('persona')
      .eq('token', token)
      .single();
    if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ persona: data.persona });
  } catch (e) {
    log.error('[shared get] error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
