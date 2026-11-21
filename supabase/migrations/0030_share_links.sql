-- Short links for shared images (flight map, badges, levels): the public page's settings, kept under a short id
-- (the hash of the settings) so the link sent on WhatsApp, LinkedIn… stays short. Only what the pilot chose to
-- share is stored (the same as the long link carried). Written and read by the website's server only.

create table if not exists public.share_links (
  id          text primary key,
  params      text not null,
  created_at  timestamptz not null default now()
);

alter table public.share_links enable row level security;
-- no policy: only the service role reads and writes
