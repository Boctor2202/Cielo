-- Saved signature: a pilot draws their signature once (pilots.signature_data_url, already there since 0001) and
-- signs their own flights, or the flights colleagues ask them to sign, with it.
--  * pilots.signature_role: the role they sign in (captain, instructor, examiner, other)
--  * pilots.auto_sign_from: when set, the pilot's own flights dated from that day are signed automatically
--    (the day after the flight, so the same day's corrections come first); null = off
--  * crew_links.auto_approve: set by the signer (the link's target) for one colleague: that colleague's
--    requests are signed with the signer's saved signature as soon as they are created; off by default
--  * signature_requests.auto: the request was signed by that rule (shown to the signer, who is notified)

alter table public.pilots
  add column if not exists signature_role text check (signature_role in ('instructor', 'captain', 'examiner', 'other')),
  add column if not exists auto_sign_from date;

alter table public.crew_links
  add column if not exists auto_approve boolean not null default false;

alter table public.signature_requests
  add column if not exists auto boolean not null default false;
