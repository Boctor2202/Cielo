-- Roster options: a duty planned but not confirmed yet (Leon prints it with its call sign).
-- Shown apart in the roster and left out of FTL limits and layovers until confirmed.
alter table public.roster_events add column if not exists tentative boolean not null default false;
