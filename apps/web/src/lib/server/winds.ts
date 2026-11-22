import { nearestLevel, pressureAt } from "@cielo/core";
import { meteredFetch } from "./usage";

/**
 * Wind and temperature at a flight level, from the Open-Meteo forecast models (hourly, pressure levels),
 * for a past or future time within about three months. With OPEN_METEO_API_KEY the commercial endpoint is
 * used (required for Geardown's use); without it, nothing is fetched.
 */
export async function windAt(lat: number, lon: number, altFt: number, unixS: number): Promise<{ level: number; windFrom: number; windKt: number; tempC: number } | null> {
  const key = process.env.OPEN_METEO_API_KEY?.trim();
  if (!key) return null;
  const level = nearestLevel(pressureAt(altFt));
  const day = new Date(unixS * 1000).toISOString().slice(0, 10);
  const qs = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    hourly: `wind_speed_${level}hPa,wind_direction_${level}hPa,temperature_${level}hPa`,
    wind_speed_unit: "kn",
    start_date: day,
    end_date: day,
    timezone: "GMT",
    timeformat: "unixtime",
    apikey: key,
  });
  const r = await meteredFetch("openmeteo", "wind", `https://customer-api.open-meteo.com/v1/forecast?${qs}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`open-meteo ${r.status}`);
  const d = (await r.json()) as { hourly?: Record<string, number[]> & { time: number[] } };
  const h = d.hourly;
  if (!h?.time?.length) return null;
  // the hour closest to the time asked
  let i = 0;
  for (let k = 1; k < h.time.length; k++) if (Math.abs(h.time[k]! - unixS) < Math.abs(h.time[i]! - unixS)) i = k;
  const ws = h[`wind_speed_${level}hPa`]?.[i];
  const wd = h[`wind_direction_${level}hPa`]?.[i];
  const tc = h[`temperature_${level}hPa`]?.[i];
  if (ws == null || wd == null || tc == null) return null;
  return { level, windFrom: Math.round(wd), windKt: Math.round(ws), tempC: Math.round(tc) };
}
