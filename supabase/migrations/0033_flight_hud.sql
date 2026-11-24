-- Takeoffs and landings flown with the head-up display: Air France follows a HUD recency (3 takeoffs and
-- 3 landings with the HUD in 90 days), read from the SAB code of the EP4/EP5 or entered by hand.

alter table public.flights
  add column if not exists hud_takeoffs integer check (hud_takeoffs is null or hud_takeoffs between 0 and 99),
  add column if not exists hud_landings integer check (hud_landings is null or hud_landings between 0 and 99);
