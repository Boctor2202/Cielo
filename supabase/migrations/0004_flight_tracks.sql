-- Real flight tracks (ADS-B), one row per logged flight (id = flight id), synced like the other pilot tables.
alter table public.aircraft add column if not exists icao_hex text
  check (icao_hex is null or icao_hex ~ '^~?[0-9a-f]{6}$');

create table if not exists public.flight_tracks (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  pilot_id    uuid not null references public.pilots (id) on delete cascade,
  flight_id   uuid not null,
  hex         text not null,
  source      text not null check (source in ('adsb.lol', 'flightaware')),
  points      jsonb not null default '[]'::jsonb
              check (jsonb_typeof(points) = 'array' and pg_column_size(points) < 200000),
  fetched_at  timestamptz not null default now()
);
create index if not exists flight_tracks_pilot_updated_idx on public.flight_tracks (pilot_id, updated_at);

create trigger flight_tracks_lww_guard before update on public.flight_tracks
  for each row execute function public.cielo_lww_guard();

alter table public.flight_tracks enable row level security;
create policy flight_tracks_owner on public.flight_tracks for all to authenticated
  using (pilot_id = (select auth.uid())) with check (pilot_id = (select auth.uid()));
grant select, insert, update, delete on public.flight_tracks to authenticated;
grant all on public.flight_tracks to service_role;
