import { FlightAwareError, flightsForRegistration } from "@/lib/flightaware";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/** GET /api/flight-lookup?reg=F-HBXA&date=2026-11-09 — actual times of that aircraft's flights that day. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const reg = (u.searchParams.get("reg") ?? "").trim();
  const date = u.searchParams.get("date") ?? "";
  if (!/^[A-Za-z0-9-]{3,10}$/.test(reg) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toISOString().slice(0, 10)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`fa:${ip}`, 15)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    return Response.json({ flights: await flightsForRegistration(reg, date) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof FlightAwareError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
