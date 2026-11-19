-- Universal import. Server only: RLS on, no policy (read and written with the service role by /api/import-any).

-- Table layouts learned from imports the pilots confirmed: the column titles of a file (its signature) and
-- which field each column holds. No flight data, no names: only column titles.
create table if not exists public.import_layouts (
  signature  text primary key,
  mapping    jsonb not null,
  source     text,
  uses       integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Documents in a layout Geardown could not read by itself, shared by the pilot (explicit consent) so a dedicated
-- reader can be written. May hold names: admin only, deleted after 90 days.
create table if not exists public.import_samples (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pilot_id   uuid references public.pilots(id) on delete cascade,
  kind       text not null,
  file_name  text,
  reader     text,
  legs       integer,
  content    text not null
);
create index if not exists import_samples_created_at on public.import_samples (created_at);

alter table public.import_layouts enable row level security;
alter table public.import_samples enable row level security;
