-- FTL settings that used to stay on each device: minutes between report and first off-block, between last
-- on-block and end of duty, and the reference time zone (null = home base airport's zone). Synced with the pilot.
alter table public.pilots
  add column if not exists ftl_report_min integer check (ftl_report_min is null or ftl_report_min between 0 and 180),
  add column if not exists ftl_release_min integer check (ftl_release_min is null or ftl_release_min between 0 and 120),
  add column if not exists ftl_timezone text;
