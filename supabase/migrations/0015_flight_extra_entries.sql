-- Logbook entries some authorities require beyond the EASA columns (all optional):
-- simulated instrument time, holds, ground training, solo time (FAA 14 CFR 61.51, Transport Canada),
-- safety pilot / instructor name, purpose of flight and intermediate stops (CAA NZ Part 61.29, CASA).
-- Approaches already live in the approaches jsonb (each may now carry its airport).

alter table public.flights
  add column if not exists sim_instrument_min  integer check (sim_instrument_min is null or sim_instrument_min between 0 and 2880),
  add column if not exists holdings            integer check (holdings is null or holdings between 0 and 99),
  add column if not exists ground_training_min integer check (ground_training_min is null or ground_training_min between 0 and 2880),
  add column if not exists solo_min            integer check (solo_min is null or solo_min between 0 and 2880),
  add column if not exists safety_pilot_name   text check (safety_pilot_name is null or length(safety_pilot_name) <= 120),
  add column if not exists purpose             text check (purpose is null or length(purpose) <= 200),
  add column if not exists via                 jsonb check (via is null or (jsonb_typeof(via) = 'array' and jsonb_array_length(via) <= 20));
