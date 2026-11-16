import { photoForAircraft, planespottersEnabled } from "@/lib/planespotters";
import { rateLimited } from "@/lib/places";

/** GET /api/aircraft-photo?reg=F-GTAM[&hex=394c0c] — the latest Planespotters photo of that exact aircraft (metadata only). */
export async function GET(req: Request) {
  if (!planespottersEnabled()) return Response.json({ error: "not_configured" }, { status: 503 });
  const u = new URL(req.url);
  const reg = (u.searchParams.get("reg") ?? "").trim().toUpperCase();
  const hex = u.searchParams.get("hex");
  if (!/^[A-Z0-9-]{3,10}$/.test(reg)) return Response.json({ error: "bad_request" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`photo:${ip}`, 30)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    return Response.json({ photo: await photoForAircraft(reg, hex) }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=64800" } });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
