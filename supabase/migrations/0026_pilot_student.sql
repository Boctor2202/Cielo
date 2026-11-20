-- Student plan: a pilot declares being a student pilot and the expected licence date (at most 24 months ahead).
-- The Student offer is shown and sold only until that date. Self-declared; a proof may be asked at renewal.
-- Reversible: alter table public.pilots drop column student_until;
-- Applied to production on 2026-11-20.
alter table public.pilots add column if not exists student_until date;
