-- Money actually received, one row per payment or refund, for the admin's tax-threshold tracking
-- (micro-entreprise turnover ceiling, VAT franchise, EU OSS). Written by the payment webhooks only.
create table if not exists public.revenue_events (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  occurred_at       timestamptz not null,
  source            text not null check (source in ('stripe', 'apple', 'google')),
  external_id       text not null,
  pilot_id          uuid references public.pilots (id) on delete set null,
  kind              text not null check (kind in ('payment', 'refund')),
  -- what the customer paid (refunds negative), in the charged currency and in EUR
  amount_cents      integer not null,
  currency          text not null,
  amount_eur_cents  integer not null,
  -- what reaches the bank after the store's commission (stores only; Stripe fees are not deducted here)
  proceeds_eur_cents integer,
  country           text,
  environment       text not null default 'production',
  unique (source, external_id)
);
create index if not exists revenue_events_occurred_idx on public.revenue_events (occurred_at);
alter table public.revenue_events enable row level security;
revoke all on public.revenue_events from anon, authenticated;
grant all on public.revenue_events to service_role;
