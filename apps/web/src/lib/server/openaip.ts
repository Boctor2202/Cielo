import type { Airspace } from "@cielo/core";
import { meteredFetch } from "./usage";

/**
 * Airspaces from openAIP (api.core.openaip.net), server-side with OPENAIP_API_KEY. Data © openAIP contributors,
 * used under the agreement Geardown holds with openAIP; shown for information, never for navigation.
 */
const BASE = "https://api.core.openaip.net/api";

// openAIP codes → short names
const TYPES: Record<number, string> = { 1: "R", 2: "D", 3: "P", 4: "CTR", 5: "TMZ", 6: "RMZ", 7: "TMA", 8: "TRA", 9: "TSA", 10: "FIR", 11: "UIR", 13: "ATZ", 14: "MATZ", 26: "CTA", 28: "TIZ", 29: "TIA" };
const CLASSES: Record<number, string> = { 0: "A", 1: "B", 2: "C", 3: "D", 4: "E", 5: "F", 6: "G" };
const REF: Record<number, Airspace["lowerRef"]> = { 0: "GND", 1: "MSL", 2: "STD" };

interface OaLimit {
  value: number;
  /** 0 metres, 1 feet, 6 flight level */
  unit: number;
  referenceDatum: number;
}
interface OaAirspace {
  _id: string;
  name: string;
  type: number;
  icaoClass?: number;
  geometry?: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
  lowerLimit?: OaLimit;
  upperLimit?: OaLimit;
  frequencies?: { value: string; name?: string; primary?: boolean }[];
}

const feet = (l?: OaLimit) => (!l ? 0 : l.unit === 6 ? l.value * 100 : l.unit === 0 ? Math.round(l.value * 3.28084) : l.value);

function toAirspace(a: OaAirspace): Airspace | null {
  const type = TYPES[a.type];
  if (!type || !a.geometry) return null;
  const polys = a.geometry.type === "Polygon" ? [a.geometry.coordinates as number[][][]] : (a.geometry.coordinates as number[][][][]);
  const rings = polys.map((p) => (p[0] ?? []).map(([x, y]) => [x!, y!] as [number, number])).filter((r) => r.length > 2);
  if (!rings.length) return null;
  return {
    id: a._id,
    name: a.name,
    type,
    icaoClass: a.icaoClass != null ? CLASSES[a.icaoClass] : undefined,
    lowerFt: feet(a.lowerLimit),
    upperFt: a.upperLimit ? feet(a.upperLimit) : 99999,
    lowerRef: a.lowerLimit ? REF[a.lowerLimit.referenceDatum] : "GND",
    upperRef: a.upperLimit ? REF[a.upperLimit.referenceDatum] : "STD",
    rings,
    frequencies: (a.frequencies ?? []).filter((f) => f.value).map((f) => ({ name: f.name, mhz: f.value })),
  };
}

/**
 * GET on the openAIP API: the key in the x-openaip-api-key header, as documented; when that is refused, once
 * more with the key in the apiKey query parameter (the other accepted form).
 */
async function openaipGet(path: string, key: string): Promise<Response> {
  const headers = { Accept: "application/json", "User-Agent": "Geardown/1.0 (+https://geardown.app)" };
  const r = await meteredFetch("openaip", "airspaces", `${BASE}${path}`, { headers: { ...headers, "x-openaip-api-key": key }, cache: "no-store" });
  if (r.status !== 401 && r.status !== 403) return r;
  return meteredFetch("openaip", "airspaces", `${BASE}${path}${path.includes("?") ? "&" : "?"}apiKey=${encodeURIComponent(key)}`, { headers, cache: "no-store" });
}

/** Admin diagnosis: openAIP's answer for one small box, key in the header, in the query, and without a key. */
export async function openaipProbe(): Promise<unknown> {
  const raw = process.env.OPENAIP_API_KEY;
  const key = raw?.trim();
  if (!key) return { error: "OPENAIP_API_KEY is not set" };
  const text = async (r: Response) => (await r.text()).replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  const url = `${BASE}/airspaces?bbox=2,48,3,49&limit=2`;
  const variants: [string, string, Record<string, string>][] = [
    ["header", url, { "x-openaip-api-key": key }],
    ["query", `${url}&apiKey=${encodeURIComponent(key)}`, {}],
    ["no key", url, {}],
  ];
  const out: Record<string, unknown> = { keyLength: key.length, spaces: key !== raw };
  for (const [name, u, h] of variants) {
    try {
      const r = await fetch(u, { headers: { Accept: "application/json", ...h }, cache: "no-store" });
      out[name] = { status: r.status, server: r.headers.get("server"), body: await text(r) };
    } catch (e) {
      out[name] = { error: e instanceof Error ? e.message : "error" };
    }
  }
  return out;
}

// one answer per 1° tile, kept a week on this instance (airspace changes every AIRAC cycle, 28 days)
const tiles = new Map<string, { at: number; items: Airspace[] }>();
const WEEK = 7 * 86_400_000;

async function tile(lon: number, lat: number, key: string): Promise<Airspace[]> {
  const id = `${lon},${lat}`;
  const hit = tiles.get(id);
  if (hit && Date.now() - hit.at < WEEK) return hit.items;
  const items: Airspace[] = [];
  for (let page = 1; page <= 5; page++) {
    const qs = new URLSearchParams({ bbox: `${lon},${lat},${lon + 1},${lat + 1}`, limit: "1000", page: String(page) });
    const r = await openaipGet(`/airspaces?${qs}`, key);
    if (!r.ok) throw new Error(`openaip ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
    const d = (await r.json()) as { items?: OaAirspace[]; totalPages?: number };
    for (const a of d.items ?? []) {
      const x = toAirspace(a);
      if (x) items.push(x);
    }
    if (!d.totalPages || page >= d.totalPages) break;
  }
  tiles.set(id, { at: Date.now(), items });
  if (tiles.size > 3000) tiles.delete(tiles.keys().next().value!);
  return items;
}

/** The airspaces around a track (the 1° tiles it passes through), without duplicates. null when not configured. */
export async function airspacesAlong(points: [number, number][]): Promise<Airspace[] | null> {
  const key = process.env.OPENAIP_API_KEY?.trim();
  if (!key) return null;
  const cells = new Set(points.map(([lat, lon]) => `${Math.floor(lon)},${Math.floor(lat)}`));
  if (cells.size > 60) throw new Error("track too long");
  const out = new Map<string, Airspace>();
  const lists = await Promise.all([...cells].map((c) => tile(Number(c.split(",")[0]), Number(c.split(",")[1]), key)));
  for (const l of lists) for (const a of l) out.set(a.id, a);
  return [...out.values()];
}
