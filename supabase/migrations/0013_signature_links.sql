-- Signature by link: a pilot sends a link (e-mail, message) to a captain, instructor or examiner who has no
-- Geardown account; they open it, check the flights and sign in the browser. Only the SHA-256 of the link's
-- secret is stored; the link works once and expires. All access goes through the web API (service role).

create table public.signature_links (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  requester_id     uuid not null references public.pilots (id) on delete cascade,
  token_hash       text not null unique,
  -- who is expected to sign, as the pilot wrote it
  signer_name      text not null,
  signer_role      text not null check (signer_role in ('instructor', 'captain', 'examiner', 'other')),
  signer_email     text,
  -- [{ flightId, flight (what the signer sees), hash }]
  flights          jsonb not null,
  expires_at       timestamptz not null,
  status           text not null default 'open' check (status in ('open', 'signed', 'refused', 'revoked', 'expired')),
  -- filled in by the signer
  signed_name      text,
  signed_licence   text,
  refusal          text,
  responded_at     timestamptz,
  responded_ip     text,
  responded_agent  text,
  signed_count     integer
);
create index signature_links_requester_idx on public.signature_links (requester_id, created_at desc);

alter table public.signature_links enable row level security;
create policy signature_links_read on public.signature_links for select to authenticated
  using ((select auth.uid()) = requester_id);
