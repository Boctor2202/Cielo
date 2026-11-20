import { FlightAwareError, flightsForRegistration, stillGood, type FoundFlight } from "@/lib/flightaware";
import { rateLimited } from "@/lib/places";
import { adminDb, userFrom } from "@/lib/server/admin";
import { adsbFlights } from "@/lib/adsbTimes";

export const dynamic = "force-dynamic";

/** Answers already paid for, in memory on this instance (the database keeps them for good). */
const cache = new Map<string, { at: number; ttl: number; flights: FoundFlight[] }>();


/**
 * GET /api/flight-lookup?reg=F-HBXA&date=2026-11-09[&hex=3986e0] — actual times of that aircraft's flights that day.
 * First from its ADS-B trace (adsb.lol: free, the last 24 h or so), then from FlightAware when configured (each
 * call costs a query: 40 a day per pilot, and answers are reused). Signed-in pilots only.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const reg = (u.searchParams.get("reg") ?? "").trim().toUpperCase();
  const date = u.searchParams.get("date") ?? "";
  const today = new Date().toISOString().slice(0, 10);
  if (!/^[A-Z0-9-]{3,10}$/.test(reg) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "signin" }, { status: 401 });

  // ADS-B first: free, for flights of today and yesterday (adsb.lol keeps about a day)
  const recent = Date.parse(today) - Date.parse(date) <= 86_400_000;
  if (recent) {
    const adsbKey = `adsb|${reg}|${date}`;
    const seen = cache.get(adsbKey);
    if (seen && Date.now() - seen.at < seen.ttl && seen.flights.length) return Response.json({ flights: seen.flights, source: "adsb", cached: true }, { headers: { "Cache-Control": "no-store" } });
    if (!rateLimited(`adsb:${user.id}`, 60, 86_400_000)) {
      const hex = (u.searchParams.get("hex") ?? "").toLowerCase();
      const found = await adsbFlights(reg, date, /^[0-9a-f]{6}$/.test(hex) ? hex : undefined).catch(() => []);
      if (found.length) {
        cache.set(adsbKey, { at: Date.now(), ttl: 5 * 60_000, flights: found });
        return Response.json({ flights: found, source: "adsb" }, { headers: { "Cache-Control": "no-store" } });
      }
    }
  }
  // nothing from ADS-B: FlightAware, if it is set up; otherwise say why
  if (!process.env.FLIGHTAWARE_API_KEY) return Response.json(recent ? { flights: [] } : { error: "adsb_window" }, { status: recent ? 200 : 404 });

  const ident = reg.replace(/[^A-Z0-9]/g, "");
  const key = `${ident}|${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return Response.json({ flights: hit.flights, cached: true }, { headers: { "Cache-Control": "no-store" } });
  // stored answers first: a query paid once is never paid again
  const db = adminDb();
  if (db) {
    const { data } = await db.from("fa_lookups").select("flights, fetched_at").eq("key", key).maybeSingle();
    if (data && stillGood(date, data.fetched_at, data.flights as FoundFlight[])) {
      cache.set(key, { at: Date.now(), ttl: 10 * 60_000, flights: data.flights as FoundFlight[] });
      return Response.json({ flights: data.flights, cached: true }, { headers: { "Cache-Control": "no-store" } });
    }
  }
  if (rateLimited(`fa:${user.id}`, 40, 86_400_000)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const flights = await flightsForRegistration(reg, date);
    const fetchedAt = new Date().toISOString();
    if (db) await db.from("fa_lookups").upsert({ key, registration: ident, day: date, flights, fetched_at: fetchedAt });
    cache.set(key, { at: Date.now(), ttl: 10 * 60_000, flights });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return Response.json({ flights }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof FlightAwareError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
