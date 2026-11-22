-- API usage, counted by the server per day and per operation, for the admin's API dashboard (calls, AI tokens
-- and an estimate of their cost). Only the server writes it (service role, through api_usage_add); no pilot data.
-- Reversible: drop function public.api_usage_add; drop table public.api_usage;

create table if not exists public.api_usage (
  day            date        not null,
  service        text        not null,
  op             text        not null,
  calls          integer     not null default 0,
  errors         integer     not null default 0,
  input_tokens   bigint      not null default 0,
  output_tokens  bigint      not null default 0,
  cost_usd       numeric(12, 6) not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (day, service, op)
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

create or replace function public.api_usage_add(p_service text, p_op text, p_calls integer, p_errors integer, p_input bigint, p_output bigint, p_cost numeric)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.api_usage as u (day, service, op, calls, errors, input_tokens, output_tokens, cost_usd)
  values ((now() at time zone 'utc')::date, p_service, p_op, p_calls, p_errors, p_input, p_output, p_cost)
  on conflict (day, service, op) do update set
    calls = u.calls + excluded.calls,
    errors = u.errors + excluded.errors,
    input_tokens = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    cost_usd = u.cost_usd + excluded.cost_usd,
    updated_at = now();
$$;
revoke all on function public.api_usage_add(text, text, integer, integer, bigint, bigint, numeric) from public, anon, authenticated;
grant execute on function public.api_usage_add(text, text, integer, integer, bigint, bigint, numeric) to service_role;
