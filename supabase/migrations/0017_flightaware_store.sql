-- FlightAware answers kept on our side, so the same query is never paid twice.
-- Server only: RLS on and no policy, read and written with the service role by /api/flight-lookup and
-- /api/flight-track/flightaware. Not synced to the apps.

create table if not exists public.fa_lookups (
  -- registration without dash, and the UTC day: "FHBXA|2026-11-09"
  key          text primary key,
  registration text not null,
  day          date not null,
  flights      jsonb not null default '[]'::jsonb,
  fetched_at   timestamptz not null default now()
);

create table if not exists public.fa_tracks (
  -- FlightAware's flight id
  fa_flight_id text primary key,
  registration text,
  points       jsonb not null,
  fetched_at   timestamptz not null default now()
);

alter table public.fa_lookups enable row level security;
alter table public.fa_tracks enable row level security;
