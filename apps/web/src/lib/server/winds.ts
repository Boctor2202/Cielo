import { gribAt, pressureAt, readGrib2, type GribField } from "@cielo/core";
import { meteredFetch } from "./usage";

/**
 * Wind and temperature at a flight level from NOAA's GFS model (public domain), read from NOAA's open data on
 * AWS: only the three fields needed (U and V wind, temperature at one pressure level) are downloaded, about
 * 50 kB each, from the run just before the flight. Any date since 2021.
 */
const BUCKET = "https://noaa-gfs-bdp-pds.s3.amazonaws.com";
const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100];
const H = 3600;

const fields = new Map<string, Promise<GribField>>();
const indexes = new Map<string, Promise<string>>();

async function idx(file: string): Promise<string> {
  let p = indexes.get(file);
  if (!p) {
    p = fetch(`${file}.idx`, { cache: "no-store", signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`gfs idx ${r.status}`))));
    p.catch(() => indexes.delete(file));
    indexes.set(file, p);
    if (indexes.size > 200) indexes.delete(indexes.keys().next().value!);
  }
  return p;
}

async function field(file: string, name: string, level: number): Promise<GribField> {
  const key = `${file}|${name}|${level}`;
  let p = fields.get(key);
  if (!p) {
    p = (async () => {
      const lines = (await idx(file)).split("\n");
      const i = lines.findIndex((l) => l.includes(`:${name}:${level} mb:`));
      if (i < 0) throw new Error(`gfs ${name} ${level} not in file`);
      const start = Number(lines[i]!.split(":")[1]);
      const end = lines[i + 1] ? Number(lines[i + 1]!.split(":")[1]) - 1 : undefined;
      const r = await meteredFetch("gfs", "field", file, { headers: { Range: `bytes=${start}-${end ?? ""}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`gfs ${r.status}`);
      return readGrib2(new Uint8Array(await r.arrayBuffer()));
    })();
    p.catch(() => fields.delete(key));
    fields.set(key, p);
    // each field is about half a megabyte decoded: keep the last ones only
    if (fields.size > 24) fields.delete(fields.keys().next().value!);
  }
  return p;
}

/** The GFS files to try for a time: the run just before it (at the nearest 3-hour step), then older runs. */
function candidates(unixS: number): string[] {
  const out: string[] = [];
  const run0 = Math.floor(unixS / (6 * H)) * 6 * H;
  for (let back = 0; back < 4; back++) {
    const run = run0 - back * 6 * H;
    const fh = Math.round((unixS - run) / (3 * H)) * 3;
    const d = new Date(run * 1000).toISOString();
    const hh = d.slice(11, 13);
    out.push(`${BUCKET}/gfs.${d.slice(0, 10).replace(/-/g, "")}/${hh}/atmos/gfs.t${hh}z.pgrb2.1p00.f${String(fh).padStart(3, "0")}`);
  }
  return out;
}

export async function windAt(lat: number, lon: number, altFt: number, unixS: number): Promise<{ level: number; windFrom: number; windKt: number; tempC: number } | null> {
  const p = pressureAt(altFt);
  const level = LEVELS.reduce((b, l) => (Math.abs(l - p) < Math.abs(b - p) ? l : b), LEVELS[0]!);
  let lastErr: unknown = null;
  for (const file of candidates(unixS)) {
    try {
      const [u, v, t] = await Promise.all([field(file, "UGRD", level), field(file, "VGRD", level), field(file, "TMP", level)]);
      const uu = gribAt(u, lat, lon);
      const vv = gribAt(v, lat, lon);
      const kt = Math.hypot(uu, vv) * 1.943844;
      // meteorological direction: where the wind blows FROM
      const from = ((Math.atan2(-uu, -vv) * 180) / Math.PI + 360) % 360;
      return { level, windFrom: Math.round(from) || 360, windKt: Math.round(kt), tempC: Math.round(gribAt(t, lat, lon) - 273.15) };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("gfs unavailable");
}
