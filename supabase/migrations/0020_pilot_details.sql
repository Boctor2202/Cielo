-- Pilot profile details: date of birth and the aircraft types the pilot currently flies.
alter table public.pilots
  add column if not exists birth_date date check (birth_date is null or birth_date > '1900-01-01'),
  add column if not exists current_types text[] check (current_types is null or cardinality(current_types) <= 12);
