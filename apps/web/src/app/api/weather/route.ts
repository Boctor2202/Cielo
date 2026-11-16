import { parseAwcMetar, parseAwcTaf, type Metar, type Taf } from "@cielo/core";
import { rateLimited } from "@/lib/places";

/**
 * GET /api/weather?ids=LFPB,LFPG — latest METAR and current TAF for up to 10 aerodromes, from the
 * Aviation Weather Center (NOAA, public domain). Cached 5 minutes so every viewer shares one upstream call.
 */
const AWC = "https://aviationweather.gov/api/data";
const UA = "Geardown/1.0 (+https://geardown.app)";

async function awc(kind: "metar" | "taf", ids: string[]): Promise<Record<string, unknown>[]> {
  const r = await fetch(`${AWC}/${kind}?ids=${ids.join(",")}&format=json`, { headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate: 300 } });
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`awc ${r.status}`);
  const d = (await r.json()) as unknown;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const ids = [...new Set((u.searchParams.get("ids") ?? "").toUpperCase().split(",").map((s) => s.trim()).filter((s) => /^[A-Z0-9]{3,4}$/.test(s)))].slice(0, 10);
  if (!ids.length) return Response.json({ error: "bad_request" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`wx:${ip}`, 60)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const [m, t] = await Promise.all([awc("metar", ids), awc("taf", ids)]);
    const metars: Record<string, Metar> = {};
    for (const o of m) {
      const x = parseAwcMetar(o);
      // the list is newest first: keep the latest report per aerodrome
      if (x && !metars[x.icao]) metars[x.icao] = x;
    }
    const tafs: Record<string, Taf> = {};
    for (const o of t) {
      const x = parseAwcTaf(o);
      if (x && !tafs[x.icao]) tafs[x.icao] = x;
    }
    return Response.json({ metars, tafs, source: "aviationweather.gov" }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
