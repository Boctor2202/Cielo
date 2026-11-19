import { FlightAwareError, flightsForRegistration, type FoundFlight } from "@/lib/flightaware";
import { rateLimited } from "@/lib/places";
import { userFrom } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** Answers already paid for: a past day does not change, today's flights are kept a short while. */
const cache = new Map<string, { at: number; ttl: number; flights: FoundFlight[] }>();

/**
 * GET /api/flight-lookup?reg=F-HBXA&date=2026-11-09 — actual times of that aircraft's flights that day.
 * Each call costs a FlightAware query: signed-in pilots only, 40 a day each, and answers are reused.
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

  const key = `${reg.replace(/[^A-Z0-9]/g, "")}|${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return Response.json({ flights: hit.flights, cached: true }, { headers: { "Cache-Control": "no-store" } });
  if (rateLimited(`fa:${user.id}`, 40, 86_400_000)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const flights = await flightsForRegistration(reg, date);
    cache.set(key, { at: Date.now(), ttl: date < today ? 7 * 86_400_000 : 20 * 60_000, flights });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return Response.json({ flights }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof FlightAwareError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
