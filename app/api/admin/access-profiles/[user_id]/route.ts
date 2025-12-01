import { NextResponse } from 'next/server';
import { updateAccessProfile } from '@/lib/access/profiles';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function PATCH(req: Request, { params }: { params: { user_id: string } }) {
  const userId = params.user_id;
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const body = (await req.json()) as unknown;
    const client = createServerSupabaseClient();
    const {
      data: { user },
      error: authErr,
    } = await client.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Auth user not found for actor' }, { status: 401 });
    }

    const actorProfileResp = await client
      .from('user_access_profiles')
      .select('role,email')
      .eq('user_id', user.id)
      .single();
    if (actorProfileResp.error || !actorProfileResp.data) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 403 });
    }

    const actorData = actorProfileResp.data as Record<string, unknown>;
    const actorEmail = typeof actorData.email === 'string' ? actorData.email : '';
    const actorRoleRaw = actorData.role as string | undefined;
    const actorRole: 'user' | 'admin' | 'superadmin' =
      actorRoleRaw === 'admin' || actorRoleRaw === 'superadmin'
        ? (actorRoleRaw as 'admin' | 'superadmin')
        : 'user';

    const actor = {
      userId: user.id,
      email: actorEmail,
      role: actorRole as 'user' | 'admin' | 'superadmin',
    };

    const updated = await updateAccessProfile(actor, {
      userId,
      status: (body && typeof body === 'object'
        ? (body as Record<string, unknown>)['status']
        : undefined) as undefined | import('@/lib/access/profiles').AccessStatus,
      role: (body && typeof body === 'object'
        ? (body as Record<string, unknown>)['role']
        : undefined) as undefined | import('@/lib/access/profiles').AccessRole,
      plan:
        body && typeof body === 'object' && 'plan' in (body as Record<string, unknown>)
          ? ((body as Record<string, unknown>)['plan'] as 'free' | 'beta' | 'paid' | null)
          : undefined,
      tags:
        body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>)['tags'])
          ? ((body as Record<string, unknown>)['tags'] as string[])
          : undefined,
      notes:
        body && typeof body === 'object' && 'notes' in (body as Record<string, unknown>)
          ? ((body as Record<string, unknown>)['notes'] as string | undefined)
          : undefined,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
