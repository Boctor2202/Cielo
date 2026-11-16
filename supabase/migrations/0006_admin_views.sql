-- Per-pilot activity for the admin back office (service role only).
create or replace view public.admin_pilot_stats as
select p.id as pilot_id,
       count(f.id) filter (where f.deleted_at is null) as flights,
       max(f.updated_at) as last_flight_change
from public.pilots p
left join public.flights f on f.pilot_id = p.id
group by p.id;
revoke all on public.admin_pilot_stats from anon, authenticated;
grant select on public.admin_pilot_stats to service_role;
