-- The pilot's CV draft (what they type in: experience, education, languages, summary…) on the pilot record,
-- so it follows them between the website and the app. Until now it stayed on the device where it was typed.
-- Covered by the pilots row-level security (own row only).
alter table public.pilots add column if not exists cv jsonb;
