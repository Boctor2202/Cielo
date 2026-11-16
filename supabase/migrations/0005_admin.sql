-- Admin back office: user feedback / bug reports / client errors, and platform switches.
-- Both tables are server-only: RLS on, no policy, so only the secret (service) key reaches them.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  pilot_id    uuid references public.pilots (id) on delete set null,
  kind        text not null check (kind in ('bug', 'idea', 'error')),
  message     text not null check (char_length(message) between 1 and 4000),
  page        text,
  platform    text check (platform in ('web', 'ios', 'android')),
  app_version text,
  user_agent  text,
  context     jsonb not null default '{}'::jsonb check (pg_column_size(context) < 20000),
  status      text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'ignored')),
  -- same client error reported again: counted instead of duplicated
  fingerprint text,
  occurrences integer not null default 1
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create unique index if not exists feedback_open_error_fp on public.feedback (fingerprint) where kind = 'error' and status <> 'resolved';
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant all on public.feedback to service_role;

create table if not exists public.platform_flags (
  key        text primary key,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.platform_flags enable row level security;
revoke all on public.platform_flags from anon, authenticated;
grant all on public.platform_flags to service_role;
insert into public.platform_flags (key, enabled) values
  ('radar', true), ('layovers', true), ('aircraftPhotos', true), ('flightTracks', true), ('jobs', true)
on conflict (key) do nothing;
