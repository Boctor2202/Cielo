-- Flight time limitation scheme the pilot flies under: EASA ORO.FTL (commercial air transport) or
-- EU-OPS Subpart Q (air taxi, single-pilot, business aviation and other operations outside ORO.FTL).
alter table public.pilots
  add column if not exists ftl_regime text check (ftl_regime is null or ftl_regime in ('oro', 'subq', 'none'));
