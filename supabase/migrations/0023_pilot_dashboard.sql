-- The pilot's Overview layout (which widgets, in which order, which size), shared by the website and the app.
-- Covered by the pilots row-level security (own row only).
alter table public.pilots add column if not exists dashboard jsonb;
