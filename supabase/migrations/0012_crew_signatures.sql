-- Signatures between Geardown pilots.
-- A pilot links the captain / instructor named on their flights (pic_name) to that person's Geardown account,
-- found by e-mail, licence number, or the same flight in both logbooks; the other pilot must accept the link.
-- Then signature requests for those flights reach the captain, who signs them in their own app; the signature
-- is written on the requester's flight. All writes go through the web API (service role): clients only read
-- the rows that concern them.

create table public.crew_links (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  requester_id  uuid not null references public.pilots (id) on delete cascade,
  target_id     uuid not null references public.pilots (id) on delete cascade,
  -- the name as the requester writes it in the PIC column
  crew_name     text not null,
  via           text not null check (via in ('email', 'licence', 'flight')),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'refused', 'revoked')),
  responded_at  timestamptz,
  check (requester_id <> target_id)
);
create unique index crew_links_open_idx on public.crew_links (requester_id, lower(crew_name)) where status in ('pending', 'accepted');
create index crew_links_target_idx on public.crew_links (target_id, status);

create table public.signature_requests (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  link_id            uuid not null references public.crew_links (id) on delete cascade,
  requester_id       uuid not null references public.pilots (id) on delete cascade,
  target_id          uuid not null references public.pilots (id) on delete cascade,
  flight_id          uuid not null,
  -- what the signer sees: date, route, times, registration, type, function…
  flight             jsonb not null,
  content_hash       text not null,
  -- the same flight in the signer's own logbook, when found
  matched_flight_id  uuid,
  status             text not null default 'pending' check (status in ('pending', 'signed', 'refused', 'cancelled')),
  refusal            text,
  signature_id       uuid,
  responded_at       timestamptz
);
create unique index signature_requests_open_idx on public.signature_requests (flight_id) where status in ('pending', 'signed');
create index signature_requests_target_idx on public.signature_requests (target_id, status);
create index signature_requests_requester_idx on public.signature_requests (requester_id, status);

alter table public.crew_links enable row level security;
alter table public.signature_requests enable row level security;
create policy crew_links_read on public.crew_links for select to authenticated
  using ((select auth.uid()) in (requester_id, target_id));
create policy signature_requests_read on public.signature_requests for select to authenticated
  using ((select auth.uid()) in (requester_id, target_id));
