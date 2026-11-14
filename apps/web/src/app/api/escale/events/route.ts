import { EventsError, eventsNear, type EventKind } from "@/lib/events";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/** GET /api/escale/events?lat=&lng=&from=2026-11-14&to=2026-11-16&kind=all&lang=fr */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const kind = (u.searchParams.get("kind") ?? "all") as EventKind;
  const lang = u.searchParams.get("lang") === "en" ? "en" : "fr";
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const fromS = u.searchParams.get("from") ?? "";
  const toS = u.searchParams.get("to") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !["all", "concerts", "shows"].includes(kind) || !day.test(fromS) || !day.test(toS)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // whole days, from midnight before arrival (UTC, generous) to the end of the departure day; at most 10 days
  const from = new Date(`${fromS}T00:00:00Z`);
  const to = new Date(Math.min(new Date(`${toS}T23:59:59Z`).getTime(), from.getTime() + 10 * 86400_000));
  if (!(to > from)) return Response.json({ error: "bad_request" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    return Response.json({ events: await eventsNear({ lat, lng }, from, to, kind, lang) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof EventsError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
