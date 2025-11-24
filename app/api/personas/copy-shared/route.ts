import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';
import { randomUUID } from 'crypto';
import { log } from '@/lib/core/logger';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const headerAuth = req.headers.get('authorization') || '';
    const bearer = headerAuth.startsWith('Bearer ') ? headerAuth.replace('Bearer ', '') : null;
    const token = (body && body.token) || null;

    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const supabase = createServerSupabaseClient();

    // Resolve user from passed access token
    let userId: string | null = null;
    if (bearer) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(bearer as string);
      if (userErr || !userData?.user) {
        return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
      }
      userId = userData.user.id;
    } else {
      return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
    }

    // Fetch shared persona
    const { data: sharedRow, error: sharedErr } = await supabase
      .from('shared_personas')
      .select('persona')
      .eq('token', token)
      .single();

    if (sharedErr || !sharedRow) {
      return NextResponse.json({ error: 'Shared persona not found' }, { status: 404 });
    }

    const rawPersona = (sharedRow && (sharedRow as Record<string, unknown>)['persona']) || null;
    const persona =
      rawPersona && typeof rawPersona === 'object' ? (rawPersona as Record<string, unknown>) : {};

    // Insert into user_personas for the authenticated user
    const id = randomUUID();
    const insertRow = {
      id,
      user_id: userId,
      name: typeof persona['name'] === 'string' ? (persona['name'] as string) : null,
      needs: typeof persona['needs'] === 'string' ? (persona['needs'] as string) : null,
      profile: typeof persona['profile'] === 'string' ? (persona['profile'] as string) : null,
      age_range:
        typeof persona['ageRange'] === 'string'
          ? (persona['ageRange'] as string)
          : typeof persona['age_range'] === 'string'
          ? (persona['age_range'] as string)
          : null,
      income: typeof persona['income'] === 'string' ? (persona['income'] as string) : null,
      status: typeof persona['status'] === 'string' ? (persona['status'] as string) : null,
      goals: Array.isArray(persona['goals']) ? (persona['goals'] as string[]) : null,
    };

    const { error: insertErr } = await supabase.from('user_personas').insert([insertRow]);
    if (insertErr) {
      log.error('[copy-shared] insert error', insertErr);
      return NextResponse.json({ error: 'Failed to insert persona' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    log.error('[copy-shared] unexpected', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
