-- Test accounts, marked from the admin: left out of the admin's lists and figures, like the admin accounts.
-- Reversible: alter table public.pilots drop column test_account;
alter table public.pilots add column if not exists test_account boolean not null default false;
