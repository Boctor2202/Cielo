import { simplifyTrack } from "@cielo/core";
import { FlightAwareError, flightsForRegistration, matchFlight, stillGood, trackForFlight, type FoundFlight } from "@/lib/flightaware";
import { rateLimited } from "@/lib/places";
import { adminDb, userFrom } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

const cache = new Map<string, { points: [number, number, number, number | null, number | null][]; faId: string }>();

/**
 * GET /api/flight-track/flightaware?reg=F-HBXA&out=…&in=… — the real track of one logged flight from FlightAware,
 * however old: the aircraft's flight matching the block times, its recorded positions, simplified.
 * Signed-in pilots only (each call is a paid query), 40 a day each.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const reg = (u.searchParams.get("reg") ?? "").trim().toUpperCase();
  const out = u.searchParams.get("out") ?? "";
  const inn = u.searchParams.get("in") ?? "";
  if (!/^[A-Z0-9-]{3,10}$/.test(reg) || Number.isNaN(Date.parse(out)) || Number.isNaN(Date.parse(inn))) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "signin" }, { status: 401 });
  const key = `${reg}|${out}|${inn}`;
  const hit = cache.get(key);
  if (hit) return Response.json({ source: "flightaware", ...hit });
  const db = adminDb();
  const ident = reg.replace(/[^A-Z0-9]/g, "");
  try {
    const date = new Date(Date.parse(out)).toISOString().slice(0, 10);
    // the aircraft's flights that day: stored, else one paid query (stored for the next time)
    let flights: FoundFlight[] | undefined;
    const lk = `${ident}|${date}`;
    if (db) {
      const { data } = await db.from("fa_lookups").select("flights, fetched_at").eq("key", lk).maybeSingle();
      if (data && stillGood(date, data.fetched_at, data.flights as FoundFlight[])) flights = data.flights as FoundFlight[];
    }
    const f0 = flights ? matchFlight(flights, out, inn) : undefined;
    // its track: stored, else one paid query
    if (f0 && db) {
      const { data } = await db.from("fa_tracks").select("points").eq("fa_flight_id", f0.id).maybeSingle();
      if (data?.points) {
        const res = { points: data.points as [number, number, number, number | null, number | null][], faId: f0.id };
        cache.set(key, res);
        return Response.json({ source: "flightaware", ...res, cached: true });
      }
    }
    if (rateLimited(`fa:${user.id}`, 40, 86_400_000)) return Response.json({ error: "rate_limited" }, { status: 429 });
    if (!flights) {
      flights = await flightsForRegistration(reg, date);
      if (db) await db.from("fa_lookups").upsert({ key: lk, registration: ident, day: date, flights, fetched_at: new Date().toISOString() });
    }
    const f = f0 ?? matchFlight(flights, out, inn);
    if (!f) return Response.json({ error: "no_match" }, { status: 404 });
    const recent = Date.now() - Date.parse(out) < 9 * 86_400_000;
    const raw = await trackForFlight(f.id, recent);
    if (raw.length < 2) return Response.json({ error: "no_match" }, { status: 404 });
    const res = { points: simplifyTrack(raw), faId: f.id };
    // a flight's track does not change once it has landed
    if (db && (f.in || f.on)) await db.from("fa_tracks").upsert({ fa_flight_id: f.id, registration: ident, points: res.points, fetched_at: new Date().toISOString() });
    cache.set(key, res);
    if (cache.size > 1000) cache.delete(cache.keys().next().value!);
    return Response.json({ source: "flightaware", ...res }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof FlightAwareError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
