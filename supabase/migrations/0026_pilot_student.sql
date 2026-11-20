-- Student plan: a pilot declares being a student pilot and the expected licence date (at most 24 months ahead).
-- The Student offer is shown and sold only until that date. Self-declared; a proof may be asked at renewal.
-- Reversible: alter table public.pilots drop column student_until;
-- NOT APPLIED: apply on explicit instruction, before turning on NEXT_PUBLIC_STUDENT_PLAN / EXPO_PUBLIC_STUDENT_PLAN.
alter table public.pilots add column if not exists student_until date;
