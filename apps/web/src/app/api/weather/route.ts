import { favouredRunway, parseAwcMetar, parseAwcTaf, type Metar, type RunwayEstimate, type Taf } from "@cielo/core";
import runwayFile from "@cielo/reference-data/runways.json";
import { rateLimited } from "@/lib/places";

/**
 * GET /api/weather?ids=LFPB,LFPG — latest METAR and current TAF for up to 10 aerodromes, from the
 * Aviation Weather Center (NOAA, public domain). Cached 5 minutes so every viewer shares one upstream call.
 * With each METAR comes the runway its wind favours (an estimate, not the ATIS runway).
 * ?taf=0 skips the TAFs (the radar only needs the METARs of the airports in view).
 */
const RUNWAYS = (runwayFile as unknown as { airports: Record<string, [string, number, number][]> }).airports;
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
  const ids = [...new Set((u.searchParams.get("ids") ?? "").toUpperCase().split(",").map((s) => s.trim()).filter((s) => /^[A-Z0-9]{3,4}$/.test(s)))].slice(0, 40);
  if (!ids.length) return Response.json({ error: "bad_request" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`wx:${ip}`, 60)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const withTaf = u.searchParams.get("taf") !== "0";
    const [m, t] = await Promise.all([awc("metar", ids), withTaf ? awc("taf", ids) : Promise.resolve([])]);
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
    const runways: Record<string, RunwayEstimate> = {};
    for (const [icao, x] of Object.entries(metars)) {
      const ends = (RUNWAYS[icao] ?? []).map(([ident, headingTrue, lengthFt]) => ({ ident, headingTrue, lengthFt }));
      const r = favouredRunway(x, ends);
      if (r) runways[icao] = r;
    }
    return Response.json({ metars, tafs, runways, source: "aviationweather.gov" }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
