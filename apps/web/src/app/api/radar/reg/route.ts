import { AdsbError, aircraftByRegistration } from "@/lib/adsb";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/** GET /api/radar/reg?r=F-GTAM — the aircraft with this registration, if it is transmitting now. */
export async function GET(req: Request) {
  const reg = (new URL(req.url).searchParams.get("r") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,10}$/.test(reg)) return Response.json({ error: "bad_request" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`reg:${ip}`, 10)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    return Response.json({ ac: await aircraftByRegistration(reg) }, { headers: { "Cache-Control": "public, s-maxage=10" } });
  } catch (e) {
    if (e instanceof AdsbError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
