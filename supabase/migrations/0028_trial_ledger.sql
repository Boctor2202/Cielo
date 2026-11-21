-- One free trial per e-mail address, even after the account is deleted and created again.
-- A fingerprint of the address (SHA-256 of the normalised address, never the address itself) is kept in
-- trial_ledger with the start of its first trial; an account created again with that address starts with the
-- original date, so its trial is not renewed. pilots.trial_started_at is the start of the account's trial,
-- owned by the server like the subscription.
-- Reversible:
--   drop trigger on_auth_user_created on auth.users; (then recreate it on the 0001 version of the function)
--   alter table public.pilots drop column trial_started_at; drop table public.trial_ledger;
--   drop function public.cielo_email_fingerprint(text);

create extension if not exists pgcrypto with schema extensions;

-- lower case, no "+tag", and for Gmail no dots (prenom.nom+x@gmail.com = prenomnom@gmail.com)
create or replace function public.cielo_email_fingerprint(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  with e as (
    select lower(trim(coalesce(email, ''))) as a
  ), p as (
    select split_part(a, '@', 1) as local,
           case split_part(a, '@', 2) when 'googlemail.com' then 'gmail.com' else split_part(a, '@', 2) end as domain
    from e
  )
  select case when position('@' in (select a from e)) = 0 then null else
    encode(extensions.digest(
      'geardown-trial:' ||
      case when domain = 'gmail.com' then replace(split_part(local, '+', 1), '.', '') else split_part(local, '+', 1) end ||
      '@' || domain, 'sha256'), 'hex')
  end
  from p;
$$;

create table if not exists public.trial_ledger (
  email_hash      text primary key,
  first_trial_at  timestamptz not null,
  created_at      timestamptz not null default now()
);
alter table public.trial_ledger enable row level security;
-- no policy: read and written by the database and the server only
revoke all on public.trial_ledger from anon, authenticated;

alter table public.pilots add column if not exists trial_started_at timestamptz;
update public.pilots set trial_started_at = created_at where trial_started_at is null;

-- every existing address, with the start of its first account
insert into public.trial_ledger (email_hash, first_trial_at)
select public.cielo_email_fingerprint(u.email), min(p.created_at)
from auth.users u join public.pilots p on p.id = u.id
where u.email is not null and u.email <> ''
group by 1
on conflict (email_hash) do nothing;

-- the pilot profile at sign-up, with the start of the trial the address already had (if any)
create or replace function public.cielo_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fp text := public.cielo_email_fingerprint(new.email);
  first_at timestamptz;
begin
  if fp is not null then
    select first_trial_at into first_at from public.trial_ledger where email_hash = fp;
    insert into public.trial_ledger (email_hash, first_trial_at) values (fp, now()) on conflict (email_hash) do nothing;
  end if;
  insert into public.pilots (id, email, full_name, created_at, updated_at, trial_started_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    now(),
    now(),
    coalesce(first_at, now())
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- End users may edit their profile but never their subscription nor the start of their trial.
create or replace function public.cielo_protect_pilot_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.cielo_is_end_user() then
    if tg_op = 'INSERT' then
      new.subscription_tier := 'free';
      new.subscription_source := null;
      new.subscription_expires_at := null;
      new.trial_started_at := null;
    else
      new.subscription_tier := old.subscription_tier;
      new.subscription_source := old.subscription_source;
      new.subscription_expires_at := old.subscription_expires_at;
      new.created_at := old.created_at;
      new.trial_started_at := old.trial_started_at;
    end if;
  end if;
  return new;
end;
$$;
