-- Main licensing authority chosen by the pilot (19 authorities, see packages/core/src/regulators.ts);
-- regulatory_framework stays the rule family (EASA / FAA / CASA) the app applies.
alter table public.pilots
  add column if not exists authority text check (authority is null or authority in (
    'EASA','UKCAA','FOCA','FAA','TCCA','ANAC_BR','ANAC_AR','DGAC_CL','GCAA','QCAA','GACA','CAAI','SACAA',
    'CASA','NZCAA','CAAC','HKCAD','JCAB','DGCA'));

-- Document kinds: ratings split into class, type and additional ("skill") ratings; radio licences and insurance.
alter table public.licenses drop constraint if exists licenses_kind_check;
alter table public.licenses add constraint licenses_kind_check check (kind in (
  'licence','medical','rating','class_rating','type_rating','skill_rating','endorsement','language','radio','insurance','other'));
