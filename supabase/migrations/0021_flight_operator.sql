-- Who operated a flight (airline, charter or private operator), typed or recognised from the call sign.
alter table public.flights add column if not exists operator text check (operator is null or length(operator) <= 120);
