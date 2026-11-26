-- Layover places recommended by members: one row per pilot and place (Google place ID, which Google allows to
-- be stored without time limit). Only the server reads and writes it; members only ever see a count per place,
-- never who recommended it. Removed with the pilot's account.
create table if not exists public.place_recommendations (
  place_id text not null check (char_length(place_id) between 5 and 300),
  pilot_id uuid not null references public.pilots (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (place_id, pilot_id)
);

create index if not exists place_recommendations_pilot on public.place_recommendations (pilot_id);

alter table public.place_recommendations enable row level security;
-- no policy: the service role only (the /api/escale/recs route)
