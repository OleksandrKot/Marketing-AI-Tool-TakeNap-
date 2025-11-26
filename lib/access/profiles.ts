'use server';

import { createServerSupabaseClient } from '@/lib/core/supabase';

export type AccessStatus = 'pending' | 'approved' | 'blocked';
export type AccessRole = 'user' | 'admin' | 'superadmin';

export type AccessProfile = {
  user_id: string;
  email: string;
  status: AccessStatus;
  role: AccessRole;
  plan: 'free' | 'beta' | 'paid' | null;
  tags: string[] | null;
  requested_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_login_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type UpdateProfileInput = {
  userId: string;
  status?: AccessStatus;
  role?: AccessRole;
  plan?: 'free' | 'beta' | 'paid' | null;
  tags?: string[];
  notes?: string;
};

export async function listAccessProfiles(): Promise<AccessProfile[]> {
  const client = createServerSupabaseClient();
  const { data, error } = await client
    .from('user_access_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as AccessProfile[];
}

export async function getAccessProfile(userId: string): Promise<AccessProfile | null> {
  const client = createServerSupabaseClient();
  const { data, error } = await client
    .from('user_access_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) {
    const errObj = error as unknown as Record<string, unknown>;
    const code =
      errObj && typeof errObj === 'object' ? (errObj['code'] as string | undefined) : undefined;
    if (code !== 'PGRST116') {
      throw new Error(error.message);
    }
  }
  return (data as AccessProfile | null) ?? null;
}

export async function updateAccessProfile(
  actor: { userId: string; email: string; role: AccessRole },
  input: UpdateProfileInput
): Promise<AccessProfile> {
  const client = createServerSupabaseClient();

  const { data: before, error: beforeErr } = await client
    .from('user_access_profiles')
    .select('*')
    .eq('user_id', input.userId)
    .single();
  if (beforeErr || !before) throw new Error(beforeErr?.message || 'Profile not found');

  if (input.role && input.role !== before.role) {
    if (actor.role !== 'superadmin') {
      throw new Error('Only superadmin can change roles');
    }
    if (before.role === 'superadmin' && input.role !== 'superadmin') {
      const { count } = await client
        .from('user_access_profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'superadmin');
      if ((count ?? 0) <= 1) {
        throw new Error('Cannot downgrade the last superadmin');
      }
    }
  }

  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (input.status && input.status !== before.status) {
    patch.status = input.status;
    if (input.status === 'approved') {
      patch.approved_at = now;
      patch.blocked_at = null;
    } else if (input.status === 'blocked') {
      patch.blocked_at = now;
    }
  }
  if (input.role && input.role !== before.role) patch.role = input.role;
  if (input.plan !== undefined) patch.plan = input.plan;
  if (input.tags) patch.tags = input.tags;
  if (input.notes !== undefined) patch.notes = input.notes;
  patch.updated_at = now;

  const { data: after, error } = await client
    .from('user_access_profiles')
    .update(patch)
    .eq('user_id', input.userId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const audits: Array<Record<string, unknown>> = [];

  if (input.status && input.status !== before.status) {
    audits.push({
      user_id: input.userId,
      actor_id: actor.userId,
      actor_email: actor.email,
      action: 'status_change',
      from_status: before.status,
      to_status: input.status,
      details: {},
    });
  }

  if (input.role && input.role !== before.role) {
    audits.push({
      user_id: input.userId,
      actor_id: actor.userId,
      actor_email: actor.email,
      action: 'role_change',
      from_role: before.role,
      to_role: input.role,
      details: {},
    });
  }

  if (input.plan !== undefined && input.plan !== before.plan) {
    audits.push({
      user_id: input.userId,
      actor_id: actor.userId,
      actor_email: actor.email,
      action: 'plan_change',
      details: { from: before.plan, to: input.plan },
    });
  }

  if (input.tags && JSON.stringify(input.tags) !== JSON.stringify(before.tags)) {
    audits.push({
      user_id: input.userId,
      actor_id: actor.userId,
      actor_email: actor.email,
      action: 'tags_change',
      details: { from: before.tags, to: input.tags },
    });
  }

  if (input.notes !== undefined && input.notes !== before.notes) {
    audits.push({
      user_id: input.userId,
      actor_id: actor.userId,
      actor_email: actor.email,
      action: 'note_change',
      details: {},
    });
  }

  if (audits.length) {
    await client.from('access_audit').insert(audits);
  }

  return after as AccessProfile;
}
