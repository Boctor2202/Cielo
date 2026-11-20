-- The Student plan was dropped: its declaration column (migration 0026) is removed. It was empty.
-- Reversible: alter table public.pilots add column student_until date;
-- Applied to production on 2026-11-20.
alter table public.pilots drop column if exists student_until;
