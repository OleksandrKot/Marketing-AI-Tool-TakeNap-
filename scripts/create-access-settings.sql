-- Access control settings for admin panel
create table if not exists access_settings (
  id int primary key default 1,
  auto_approve_new_users boolean not null default false,
  is_beta_mode boolean not null default false,
  max_approved_users int,
  allowed_domains text[] default '{}',
  blocked_domains text[] default '{}',
  notify_on_new_pending boolean not null default false,
  notify_on_approve boolean not null default false,
  notify_on_block boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into access_settings (id)
values (1)
on conflict (id) do nothing;


