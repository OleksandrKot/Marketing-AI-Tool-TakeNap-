-- Access control core tables: user_access_profiles + access_audit

create table if not exists user_access_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','approved','blocked')),
  role text not null default 'user' check (role in ('user','admin','superadmin')),
  plan text check (plan in ('free','beta','paid')),
  tags text[] default '{}',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  blocked_at timestamptz,
  last_login_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_access_profiles_status_idx on user_access_profiles(status);
create index if not exists user_access_profiles_role_idx on user_access_profiles(role);
create index if not exists user_access_profiles_plan_idx on user_access_profiles(plan);
create index if not exists user_access_profiles_last_login_idx on user_access_profiles(last_login_at);

create table if not exists access_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_access_profiles(user_id) on delete cascade,
  actor_id uuid references user_access_profiles(user_id),
  actor_email text,
  action text not null,
  from_status text,
  to_status text,
  from_role text,
  to_role text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists access_audit_user_id_created_at_idx
  on access_audit(user_id, created_at desc);


