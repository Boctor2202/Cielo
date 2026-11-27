-- Logbook endorsements (FAA, AC 61-65K): received from an instructor (signed on the pilot's screen, by link, or
-- copied from paper) or given by the pilot as an instructor (their record under 14 CFR 61.189). Synced like the
-- other logbook tables. A link (signature_links) can now carry one endorsement for an instructor to sign.
-- Reversible: drop table public.endorsements; alter table public.signature_links drop column endorsement, drop column endorsement_id;

create table if not exists public.endorsements (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  pilot_id                uuid not null references public.pilots (id) on delete cascade,
  direction               text not null check (direction in ('received', 'given')),
  template_id             text not null check (char_length(template_id) <= 20),
  title                   text not null check (char_length(title) <= 300),
  regulation              text check (char_length(regulation) <= 300),
  text                    text not null check (char_length(text) <= 5000),
  student_name            text not null check (char_length(student_name) <= 200),
  aircraft                text check (char_length(aircraft) <= 200),
  issued_on               date not null,
  expires_on              date,
  instructor_name         text check (char_length(instructor_name) <= 200),
  instructor_certificate  text check (char_length(instructor_certificate) <= 60),
  instructor_cert_kind    text check (instructor_cert_kind in ('RE', 'Exp')),
  instructor_cert_date    date,
  signature_image         text check (char_length(signature_image) <= 400000),
  signed_at               timestamptz,
  content_hash            text,
  source                  text not null default 'here' check (source in ('here', 'link', 'paper')),
  attachment_data_url     text,
  test_kind               text check (char_length(test_kind) <= 200),
  test_result             text check (char_length(test_result) <= 200),
  notes                   text check (char_length(notes) <= 2000)
);
create index if not exists endorsements_pilot_updated_idx on public.endorsements (pilot_id, updated_at);

create trigger endorsements_lww_guard before update on public.endorsements
  for each row execute function public.cielo_lww_guard();

alter table public.endorsements enable row level security;
create policy endorsements_owner on public.endorsements for all to authenticated
  using (pilot_id = (select auth.uid())) with check (pilot_id = (select auth.uid()));
grant select, insert, update, delete on public.endorsements to authenticated;

-- a signature link for one endorsement (the flights list stays empty)
alter table public.signature_links alter column flights set default '[]'::jsonb;
alter table public.signature_links add column if not exists endorsement_id uuid;
alter table public.signature_links add column if not exists endorsement jsonb;
