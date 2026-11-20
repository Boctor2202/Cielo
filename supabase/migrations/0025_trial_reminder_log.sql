-- Trial-end reminders (J-7, J-1): one row per pilot and reminder, so a re-run of the daily job never sends twice.
-- Reversible: drop table public.trial_reminder_log;
-- NOT APPLIED: apply on explicit instruction.
create table if not exists public.trial_reminder_log (
  pilot_id uuid not null references public.pilots (id) on delete cascade,
  days_left smallint not null check (days_left in (7, 1)),
  sent_on date not null default ((now() at time zone 'utc')::date),
  primary key (pilot_id, days_left)
);
alter table public.trial_reminder_log enable row level security;
-- no policy: written and read by the server only
