-- Crew hotel as a Google place ID (Google's terms allow storing place IDs only).
alter table public.layovers add column if not exists hotel_place_id text;
