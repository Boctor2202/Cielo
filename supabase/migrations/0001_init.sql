-- =============================================================================
-- Cielo — initial schema
-- One table per TableName of packages/core/src/store.ts. Column names are the
-- snake_case of the TS interface fields (packages/core/src/types.ts), so that
-- rowToDb()/rowFromDb() map 1:1 with no per-table code.
--
-- Conventions
--   * durations: integer minutes
--   * instants: timestamptz (UTC), dates: date
--   * enums: text + CHECK (cheaper to evolve than Postgres enums)
--   * soft deletes (deleted_at) so deletions propagate through sync
--   * updated_at is set by the CLIENT (last-write-wins). A guard trigger
--     refuses an update carrying an older updated_at than the stored row.
--   * No foreign keys between synced user tables other than pilot_id: the
--     sync engine pushes table by table and rows may arrive in any order
--     (flights.signature_id <-> signatures.flight_id is even circular).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Last-write-wins guard: silently keep the stored row when the incoming one is older.
create or replace function public.cielo_lww_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null; -- skip this row, no error (upsert of a stale row is a no-op)
  end if;
  return new;
end;
$$;

-- True when the current statement comes from an end-user JWT (not service role / admin).
create or replace function public.cielo_is_end_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- =============================================================================
-- pilots
-- =============================================================================
create table public.pilots (
  id                       uuid primary key references auth.users (id) on delete cascade,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  email                    text not null default '',
  full_name                text not null default '',
  display_name             text,
  locale                   text not null default 'fr'
                             check (locale in ('fr', 'en')),
  regulatory_framework     text not null default 'EASA'
                             check (regulatory_framework in ('EASA', 'FAA', 'CASA')),
  home_base_icao           text,
  licence_number           text,
  default_function         text not null default 'PIC'
                             check (default_function in ('PIC', 'SIC', 'PICUS', 'DUAL', 'FI', 'FE')),
  default_ifr              text not null default 'ask'
                             check (default_ifr in ('never', 'always', 'ask')),
  default_pilot_flying     text not null default 'always'
                             check (default_pilot_flying in ('always', 'never', 'alternate')),
  time_display             text not null default 'hhmm'
                             check (time_display in ('hhmm', 'decimal')),
  signature_data_url       text,
  subscription_tier        text not null default 'free'
                             check (subscription_tier in ('free', 'basic', 'premium')),
  subscription_source      text
                             check (subscription_source in ('stripe', 'apple', 'google')),
  subscription_expires_at  timestamptz
);
create index pilots_updated_at_idx on public.pilots (id, updated_at);

-- End users may edit their profile but never their subscription.
create or replace function public.cielo_protect_pilot_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.cielo_is_end_user() then
    if tg_op = 'INSERT' then
      new.subscription_tier := 'free';
      new.subscription_source := null;
      new.subscription_expires_at := null;
    else
      new.subscription_tier := old.subscription_tier;
      new.subscription_source := old.subscription_source;
      new.subscription_expires_at := old.subscription_expires_at;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger pilots_protect_subscription
  before insert or update on public.pilots
  for each row execute function public.cielo_protect_pilot_subscription();

-- Create the pilot profile when a user signs up.
create or replace function public.cielo_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pilots (id, email, full_name, created_at, updated_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.cielo_handle_new_user();

-- =============================================================================
-- aircraft_types (owner_pilot_id null = public reference data)
-- id is text: reference rows use stable ids such as 'ref-A320'
-- (packages/reference-data); user-created rows use uuids.
-- =============================================================================
create table public.aircraft_types (
  id                     text primary key default (gen_random_uuid())::text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  icao                   text not null,
  manufacturer           text not null default '',
  model                  text not null default '',
  category               text not null
                           check (category in ('airplane', 'helicopter', 'glider', 'tmg', 'balloon', 'airship', 'ulm')),
  engine_type            text not null
                           check (engine_type in ('piston', 'turboprop', 'jet', 'turboshaft', 'electric', 'none')),
  engine_count           integer not null default 1 check (engine_count >= 0),
  multi_pilot            boolean not null default false,
  class_or_type_rating   text,
  owner_pilot_id         uuid references public.pilots (id) on delete cascade
);
create index aircraft_types_owner_updated_idx on public.aircraft_types (owner_pilot_id, updated_at);
create index aircraft_types_public_updated_idx on public.aircraft_types (updated_at) where owner_pilot_id is null;
create index aircraft_types_icao_idx on public.aircraft_types (icao);

-- =============================================================================
-- aircraft
-- =============================================================================
create table public.aircraft (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  pilot_id            uuid not null references public.pilots (id) on delete cascade,
  registration        text not null,
  aircraft_type_id    text not null, -- aircraft_types.id (no FK, see header)
  variant             text,
  operator            text,
  complex             boolean,
  high_performance    boolean,
  tailwheel           boolean,
  default_operation   text not null default 'single_pilot'
                        check (default_operation in ('single_pilot', 'multi_pilot')),
  notes               text
);
create index aircraft_pilot_updated_idx on public.aircraft (pilot_id, updated_at);

-- =============================================================================
-- flights
-- =============================================================================
create table public.flights (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  pilot_id              uuid not null references public.pilots (id) on delete cascade,
  date                  date not null,
  flight_number         text,
  source                text not null default 'manual'
                          check (source in ('manual', 'import', 'roster', 'scan')),
  roster_event_id       uuid,

  dep_icao              text not null,
  arr_icao              text not null,
  out_utc               timestamptz,
  off_utc               timestamptz,
  on_utc                timestamptz,
  in_utc                timestamptz,

  aircraft_id           uuid,
  registration          text,
  aircraft_type_icao    text,
  aircraft_model        text,

  total_min             integer not null default 0 check (total_min >= 0),
  air_min               integer not null default 0 check (air_min >= 0),
  single_pilot_se_min   integer not null default 0 check (single_pilot_se_min >= 0),
  single_pilot_me_min   integer not null default 0 check (single_pilot_me_min >= 0),
  multi_pilot_min       integer not null default 0 check (multi_pilot_min >= 0),

  "function"            text not null default 'PIC'
                          check ("function" in ('PIC', 'SIC', 'PICUS', 'DUAL', 'FI', 'FE')),
  pic_name              text,
  pic_min               integer not null default 0 check (pic_min >= 0),
  picus_min             integer not null default 0 check (picus_min >= 0),
  copilot_min           integer not null default 0 check (copilot_min >= 0),
  dual_min              integer not null default 0 check (dual_min >= 0),
  instructor_min        integer not null default 0 check (instructor_min >= 0),
  examiner_min          integer not null default 0 check (examiner_min >= 0),

  night_min             integer not null default 0 check (night_min >= 0),
  ifr_min               integer not null default 0 check (ifr_min >= 0),
  actual_imc_min        integer not null default 0 check (actual_imc_min >= 0),
  xc_min                integer not null default 0 check (xc_min >= 0),
  night_calc            text not null default 'auto' check (night_calc in ('auto', 'manual')),

  takeoffs_day          integer not null default 0 check (takeoffs_day >= 0),
  takeoffs_night        integer not null default 0 check (takeoffs_night >= 0),
  landings_day          integer not null default 0 check (landings_day >= 0),
  landings_night        integer not null default 0 check (landings_night >= 0),
  pilot_flying          boolean not null default true,

  approaches            jsonb not null default '[]'::jsonb check (jsonb_typeof(approaches) = 'array'),

  is_fstd               boolean not null default false,
  fstd_type             text,
  fstd_qualification    text,
  fstd_min              integer not null default 0 check (fstd_min >= 0),

  crew                  jsonb not null default '[]'::jsonb check (jsonb_typeof(crew) = 'array'),
  remarks               text,
  signature_id          uuid,
  locked                boolean not null default false
);
create index flights_pilot_updated_idx on public.flights (pilot_id, updated_at);
create index flights_pilot_date_idx on public.flights (pilot_id, date);

-- =============================================================================
-- signatures
-- =============================================================================
create table public.signatures (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  pilot_id                 uuid not null references public.pilots (id) on delete cascade,
  flight_id                uuid not null,
  signer_name              text not null,
  signer_role              text not null
                             check (signer_role in ('instructor', 'captain', 'examiner', 'other')),
  signer_licence_number    text,
  signed_at                timestamptz not null,
  image_data_url           text not null,
  content_hash             text not null
);
create index signatures_pilot_updated_idx on public.signatures (pilot_id, updated_at);
create index signatures_flight_idx on public.signatures (flight_id);

-- =============================================================================
-- opening_balances
-- =============================================================================
create table public.opening_balances (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  pilot_id              uuid not null references public.pilots (id) on delete cascade,
  as_of_date            date not null,
  label                 text,
  aircraft_type_icao    text,
  total_min             integer not null default 0 check (total_min >= 0),
  single_pilot_se_min   integer not null default 0 check (single_pilot_se_min >= 0),
  single_pilot_me_min   integer not null default 0 check (single_pilot_me_min >= 0),
  multi_pilot_min       integer not null default 0 check (multi_pilot_min >= 0),
  pic_min               integer not null default 0 check (pic_min >= 0),
  copilot_min           integer not null default 0 check (copilot_min >= 0),
  dual_min              integer not null default 0 check (dual_min >= 0),
  instructor_min        integer not null default 0 check (instructor_min >= 0),
  night_min             integer not null default 0 check (night_min >= 0),
  ifr_min               integer not null default 0 check (ifr_min >= 0),
  landings_day          integer not null default 0 check (landings_day >= 0),
  landings_night        integer not null default 0 check (landings_night >= 0),
  fstd_min              integer not null default 0 check (fstd_min >= 0)
);
create index opening_balances_pilot_updated_idx on public.opening_balances (pilot_id, updated_at);

-- =============================================================================
-- licenses
-- =============================================================================
create table public.licenses (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  pilot_id              uuid not null references public.pilots (id) on delete cascade,
  kind                  text not null
                          check (kind in ('licence', 'medical', 'rating', 'endorsement', 'language', 'other')),
  code                  text not null,
  authority             text,
  number                text,
  issued_on             date,
  valid_until           date,
  last_check_on         date,
  alert_days            integer[] not null default '{90,30,7}',
  notes                 text,
  attachment_data_url   text
);
create index licenses_pilot_updated_idx on public.licenses (pilot_id, updated_at);
create index licenses_valid_until_idx on public.licenses (valid_until) where deleted_at is null;

-- =============================================================================
-- rosters
-- =============================================================================
create table public.rosters (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  pilot_id        uuid not null references public.pilots (id) on delete cascade,
  source          text not null check (source in ('csv', 'ical', 'ical_url', 'manual')),
  file_name       text,
  period_start    date,
  period_end      date,
  imported_at     timestamptz not null default now()
);
create index rosters_pilot_updated_idx on public.rosters (pilot_id, updated_at);

-- =============================================================================
-- roster_events
-- =============================================================================
create table public.roster_events (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  pilot_id              uuid not null references public.pilots (id) on delete cascade,
  roster_id             uuid,
  kind                  text not null
                          check (kind in ('FLIGHT', 'DEADHEAD', 'STANDBY', 'SIM', 'GROUND', 'OFF', 'REST', 'LEAVE', 'OTHER')),
  title                 text,
  report_utc            timestamptz,
  start_utc             timestamptz not null,
  end_utc               timestamptz not null,
  debrief_utc           timestamptz,
  flight_number         text,
  dep_icao              text,
  arr_icao              text,
  aircraft_reg          text,
  aircraft_type_icao    text,
  crew                  jsonb check (crew is null or jsonb_typeof(crew) = 'array'),
  flight_id             uuid,
  external_uid          text
);
create index roster_events_pilot_updated_idx on public.roster_events (pilot_id, updated_at);
create index roster_events_pilot_start_idx on public.roster_events (pilot_id, start_utc);

-- =============================================================================
-- layovers
-- =============================================================================
create table public.layovers (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  pilot_id           uuid not null references public.pilots (id) on delete cascade,
  airport_icao       text not null,
  roster_event_id    uuid,
  arrival_utc        timestamptz,
  departure_utc      timestamptz,
  hotel_name         text,
  address            text,
  phone              text,
  notes              text,
  contacts           jsonb not null default '[]'::jsonb check (jsonb_typeof(contacts) = 'array')
);
create index layovers_pilot_updated_idx on public.layovers (pilot_id, updated_at);

-- =============================================================================
-- Server-only tables (not synced)
-- =============================================================================

-- Store / Stripe subscriptions. Written only by edge functions (service role).
create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  pilot_id              uuid not null references public.pilots (id) on delete cascade,
  source                text not null check (source in ('stripe', 'apple', 'google')),
  -- Stripe subscription id / RevenueCat original_transaction_id
  external_id           text not null,
  -- Stripe customer id (cus_...) / RevenueCat app_user_id
  customer_id           text,
  product_id            text,
  tier                  text not null default 'free' check (tier in ('free', 'basic', 'premium')),
  status                text not null,
  current_period_end    timestamptz,
  raw                   jsonb not null default '{}'::jsonb,
  unique (source, external_id)
);
create index subscriptions_pilot_idx on public.subscriptions (pilot_id, updated_at);
create index subscriptions_customer_idx on public.subscriptions (source, customer_id);

-- Expo push tokens registered by the mobile app.
create table public.push_tokens (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  pilot_id      uuid not null references public.pilots (id) on delete cascade,
  token         text not null unique,
  platform      text not null check (platform in ('ios', 'android', 'web'))
);
create index push_tokens_pilot_idx on public.push_tokens (pilot_id, updated_at);

-- Idempotency log for license-alerts (a cron re-run must not send twice).
create table public.license_alert_log (
  license_id    uuid not null references public.licenses (id) on delete cascade,
  pilot_id      uuid not null references public.pilots (id) on delete cascade,
  alert_date    date not null,
  days_left     integer not null,
  sent_at       timestamptz not null default now(),
  primary key (license_id, alert_date)
);

-- =============================================================================
-- LWW guard on every synced table
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'pilots', 'aircraft_types', 'aircraft', 'flights', 'opening_balances',
    'signatures', 'licenses', 'rosters', 'roster_events', 'layovers'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.cielo_lww_guard()',
      t || '_lww_guard', t
    );
  end loop;
end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.pilots             enable row level security;
alter table public.aircraft_types     enable row level security;
alter table public.aircraft           enable row level security;
alter table public.flights            enable row level security;
alter table public.opening_balances   enable row level security;
alter table public.signatures         enable row level security;
alter table public.licenses           enable row level security;
alter table public.rosters            enable row level security;
alter table public.roster_events      enable row level security;
alter table public.layovers           enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.push_tokens        enable row level security;
alter table public.license_alert_log  enable row level security;

-- Nothing is readable anonymously.
revoke all on all tables in schema public from anon;

-- pilots: own row only. Rows are created by the auth trigger, but insert is
-- allowed so an upsert from the sync engine works; delete goes through gdpr-delete.
create policy pilots_select on public.pilots
  for select to authenticated using (id = (select auth.uid()));
create policy pilots_insert on public.pilots
  for insert to authenticated with check (id = (select auth.uid()));
create policy pilots_update on public.pilots
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select, insert, update on public.pilots to authenticated;

-- aircraft_types: public reference rows readable by everyone signed in,
-- private rows read/written by their owner only.
create policy aircraft_types_select on public.aircraft_types
  for select to authenticated
  using (owner_pilot_id is null or owner_pilot_id = (select auth.uid()));
create policy aircraft_types_insert on public.aircraft_types
  for insert to authenticated with check (owner_pilot_id = (select auth.uid()));
create policy aircraft_types_update on public.aircraft_types
  for update to authenticated
  using (owner_pilot_id = (select auth.uid())) with check (owner_pilot_id = (select auth.uid()));
create policy aircraft_types_delete on public.aircraft_types
  for delete to authenticated using (owner_pilot_id = (select auth.uid()));
grant select, insert, update, delete on public.aircraft_types to authenticated;

-- Plain pilot-owned tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'aircraft', 'flights', 'opening_balances', 'signatures', 'licenses',
    'rosters', 'roster_events', 'layovers', 'push_tokens'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (pilot_id = (select auth.uid())) with check (pilot_id = (select auth.uid()))',
      t || '_owner', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- subscriptions: the owner may read, only the service role (bypasses RLS) writes.
create policy subscriptions_select on public.subscriptions
  for select to authenticated using (pilot_id = (select auth.uid()));
revoke all on public.subscriptions from authenticated;
grant select on public.subscriptions to authenticated;

-- license_alert_log: service role only (RLS on, no policy, no grant).
revoke all on public.license_alert_log from authenticated;

grant all on all tables in schema public to service_role;

-- =============================================================================
-- Storage: private bucket "attachments", objects under "<uid>/..."
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_update on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
