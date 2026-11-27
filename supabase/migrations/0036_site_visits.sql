-- Visitors of the website, for the admin's daily count: one row per visitor and day. The visitor is a hash of
-- the day, the network address and the browser with a server secret, so it changes every day and cannot be
-- traced back to a person; no cookie is set. Rows older than 13 months are deleted by the server.
-- Reversible: drop table public.site_visits;
create table if not exists public.site_visits (
  day date not null,
  visitor text not null check (char_length(visitor) = 20),
  first_path text,
  ref_host text,
  country text,
  created_at timestamptz not null default now(),
  primary key (day, visitor)
);
alter table public.site_visits enable row level security;
-- no policy: written and read by the server only
