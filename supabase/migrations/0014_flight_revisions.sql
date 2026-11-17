-- Audit trail of the logbook: every change to a flight (created, changed field by field with the old and new
-- value, deleted, restored, signed), written by the apps next to the flight and synced like the other tables.
-- Rows are only ever added: the sync upserts them (so update is granted), but a trigger keeps the content of
-- an existing row as it was; there is no delete grant.

create table if not exists public.flight_revisions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  pilot_id    uuid not null references public.pilots (id) on delete cascade,
  flight_id   uuid not null,
  at          timestamptz not null,
  action      text not null check (action in ('create', 'update', 'delete', 'restore', 'sign', 'unsign')),
  source      text not null check (source in ('ios', 'android', 'web', 'import', 'server')),
  changes     jsonb not null default '[]'::jsonb
              check (jsonb_typeof(changes) = 'array' and pg_column_size(changes) < 100000)
);
create index if not exists flight_revisions_pilot_updated_idx on public.flight_revisions (pilot_id, updated_at);
create index if not exists flight_revisions_flight_idx on public.flight_revisions (flight_id, at);

alter table public.flight_revisions enable row level security;
create policy flight_revisions_read on public.flight_revisions for select to authenticated
  using (pilot_id = (select auth.uid()));
create policy flight_revisions_add on public.flight_revisions for insert to authenticated
  with check (pilot_id = (select auth.uid()));
create policy flight_revisions_upsert on public.flight_revisions for update to authenticated
  using (pilot_id = (select auth.uid())) with check (pilot_id = (select auth.uid()));
grant select, insert, update on public.flight_revisions to authenticated;

-- an entry of the trail never changes once written
create or replace function public.cielo_revision_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.flight_id := old.flight_id;
  new.pilot_id := old.pilot_id;
  new.at := old.at;
  new.action := old.action;
  new.source := old.source;
  new.changes := old.changes;
  new.created_at := old.created_at;
  new.deleted_at := old.deleted_at;
  return new;
end;
$$;
create trigger flight_revisions_immutable before update on public.flight_revisions
  for each row execute function public.cielo_revision_immutable();
grant all on public.flight_revisions to service_role;
