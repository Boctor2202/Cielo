-- Goals the pilot sets (hours, hours on a type, PIC, night, IFR, landings…), with optional deadlines.
-- A JSON array of { id, kind, target, icao?, by? }; null = the automatic goals. Synced with the pilot.
alter table public.pilots
  add column if not exists goals jsonb check (goals is null or (jsonb_typeof(goals) = 'array' and pg_column_size(goals) < 20000));
