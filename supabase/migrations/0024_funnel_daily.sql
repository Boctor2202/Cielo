-- Privacy-respecting product metrics: daily counters per event and platform, nothing else.
-- No user id, no IP, no flight, document or medical content. Written only by the server (service role).
-- Reversible: drop table public.funnel_daily; drop function public.funnel_bump;
-- NOT APPLIED: apply on explicit instruction.

create table if not exists public.funnel_daily (
  day date not null,
  event text not null check (event ~ '^[a-z_]{3,40}$'),
  platform text not null check (platform in ('web', 'ios', 'android')),
  count integer not null default 0,
  primary key (day, event, platform)
);

alter table public.funnel_daily enable row level security;
-- no policy: clients cannot read or write; the server uses the service role

create or replace function public.funnel_bump(p_event text, p_platform text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.funnel_daily (day, event, platform, count)
  values ((now() at time zone 'utc')::date, p_event, p_platform, 1)
  on conflict (day, event, platform) do update set count = public.funnel_daily.count + 1;
$$;

revoke all on function public.funnel_bump(text, text) from public, anon, authenticated;
