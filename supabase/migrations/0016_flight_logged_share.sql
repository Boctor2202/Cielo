-- Augmented crew: the share of the block time the pilot logs (1/2, 1/3, 2/3, 1/4); null = all of it.
alter table public.flights
  add column if not exists logged_share numeric check (logged_share is null or (logged_share > 0 and logged_share <= 1));
