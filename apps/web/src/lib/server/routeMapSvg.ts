import { readFile } from "node:fs/promises";
import path from "node:path";
import { greatCirclePath } from "@cielo/core";
import { AirportIndex, expandAirports, type AirportFile } from "@cielo/reference-data";
import land from "./land-50m.json";

let airports: Promise<AirportIndex> | null = null;
/** The airport table, from the site's own public file (CDN), else from the disk in development. */
export const serverAirports = (origin: string) =>
  (airports ??= (async () => {
    const r = await fetch(`${origin}/data/airports.json`).catch(() => null);
    const f = (r?.ok ? await r.json() : JSON.parse(await readFile(path.join(process.cwd(), "public/data/airports.json"), "utf8"))) as AirportFile;
    return new AirportIndex(expandAirports(f));
  })().catch((e) => {
    airports = null;
    throw e;
  }));

// Natural Earth cuts the land at ±180° but keeps each cut ring whole: a ring that jumps across the map is split
// into its pieces on each side (Chukotka, Fiji), each closed along the edge. Antarctica is left out (never framed).
const RINGS = (land as { rings: number[][] }).rings.flatMap((raw) => {
  const pieces: number[][] = [[]];
  for (let i = 0; i < raw.length; i += 2) {
    if (i && Math.abs(raw[i]! - raw[i - 2]!) > 180) pieces.push([]);
    pieces[pieces.length - 1]!.push(raw[i]!, raw[i + 1]!);
  }
  // the ring starts and ends on the same side: its last piece and its first are one
  if (pieces.length > 1 && pieces.length % 2 === 1) pieces[0] = [...pieces.pop()!, ...pieces[0]!];
  return pieces.flatMap((r) => {
    let w = 180, e = -180, s = 90, n = -90;
    for (let i = 0; i < r.length; i += 2) {
      w = Math.min(w, r[i]!);
      e = Math.max(e, r[i]!);
      s = Math.min(s, r[i + 1]!);
      n = Math.max(n, r[i + 1]!);
    }
    return s < -60 || r.length < 6 ? [] : [{ r, w, e, s, n }];
  });
});

const RAD = Math.PI / 180;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-80, Math.min(84, lat)) * RAD) / 2));
const latOf = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;

export interface MapPoint {
  icao: string;
  lat: number;
  lon: number;
  n: number;
}

/**
 * The route map of a share image, as an SVG (land, great-circle routes with a glow, airports sized by visits),
 * framed on the airports flown, and where each airport lands in pixels (to write the busiest ones' codes).
 */
export function routeMapSvg(routes: { a: MapPoint; b: MapPoint; n: number }[], points: MapPoint[], W: number, H: number, k: number) {
  // the longitudes as one continuous run: across the Pacific, the Americas are moved east by 360°
  const span = (ls: number[]) => Math.max(...ls) - Math.min(...ls);
  const lons = points.map((p) => p.lon);
  const shifted = lons.map((l) => (l < 0 ? l + 360 : l));
  const wrap = points.length > 1 && span(shifted) < span(lons);
  const lonOf = (l: number) => (wrap && l < 0 ? l + 360 : l);

  // the frame: every airport, a margin, at least ~10° wide, in the image's proportions
  let w = points.length ? Math.min(...points.map((p) => lonOf(p.lon))) : -20;
  let e = points.length ? Math.max(...points.map((p) => lonOf(p.lon))) : 40;
  let y0 = points.length ? Math.min(...points.map((p) => mercY(p.lat))) : mercY(30);
  let y1 = points.length ? Math.max(...points.map((p) => mercY(p.lat))) : mercY(60);
  const cx = (w + e) / 2;
  const cy = (y0 + y1) / 2;
  let dx = Math.max(10, (e - w) * 1.3) * RAD; // in radians, as the Mercator y
  let dy = Math.max(10 * RAD, (y1 - y0) * 1.35);
  if (dx / dy < W / H) dx = (dy * W) / H;
  else dy = (dx * H) / W;
  dx = Math.min(dx, 2 * Math.PI);
  w = cx - dx / 2 / RAD;
  e = cx + dx / 2 / RAD;
  y0 = cy - dy / 2;
  y1 = cy + dy / 2;
  const s = W / dx;
  const X = (lon: number) => (lon - w) * RAD * s;
  const Y = (lat: number) => (y1 - mercY(lat)) * s;
  const n0 = latOf(y1) + 2;
  const s0 = latOf(y0) - 2;
  const f = (v: number) => Math.round(v * 10) / 10;

  // the land, copied a turn west or east where the frame crosses ±180°
  let landPath = "";
  for (const off of [-360, 0, 360]) {
    for (const g of RINGS) {
      if (g.e + off < w - 1 || g.w + off > e + 1 || g.n < s0 || g.s > n0) continue;
      let d = "";
      let px = NaN, py = NaN;
      for (let i = 0; i < g.r.length; i += 2) {
        const x = f(X(g.r[i]! + off));
        const y = f(Y(g.r[i + 1]!));
        if (x === px && y === py) continue;
        d += `${d ? "L" : "M"}${x} ${y}`;
        px = x;
        py = y;
      }
      landPath += `${d}Z`;
    }
  }

  // each route: the great circle, kept continuous (no jump at ±180°), then moved to the frame's side
  const max = Math.max(1, ...routes.map((r) => r.n));
  const lines = routes
    .slice()
    .sort((a, b) => a.n - b.n)
    .map((r) => {
      const pts = greatCirclePath(r.a, r.b, 64);
      let prev = lonOf(pts[0]![0]);
      const run = pts.map(([lon, lat], i) => {
        let l = i === 0 ? prev : lon;
        while (l - prev > 180) l -= 360;
        while (prev - l > 180) l += 360;
        prev = l;
        return [l, lat] as const;
      });
      const d = run.map(([l, lat], i) => `${i ? "L" : "M"}${f(X(l))} ${f(Y(lat))}`).join("");
      const sw = (1.6 + 3.2 * Math.sqrt(r.n / max)) * k;
      return { d, sw };
    });

  const vmax = Math.max(1, ...points.map((p) => p.n));
  const dots = points.map((p) => ({ icao: p.icao, n: p.n, x: X(lonOf(p.lon)), y: Y(p.lat), r: (4 + 7 * Math.sqrt(p.n / vmax)) * k }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${6 * k}"/></filter>
</defs>
<path d="${landPath}" fill="#14304f" stroke="#24507e" stroke-width="${0.8 * k}" stroke-linejoin="round"/>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
<g filter="url(#g)" opacity="0.55">${lines.map((l) => `<path d="${l.d}" stroke="#22c55e" stroke-width="${l.sw * 2.6}"/>`).join("")}</g>
${lines.map((l) => `<path d="${l.d}" stroke="#4ade80" stroke-width="${l.sw}" opacity="0.92"/>`).join("")}
</g>
${dots.map((d) => `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r)}" fill="#ffffff" stroke="#07101f" stroke-width="${2 * k}"/>`).join("")}
</svg>`;
  return { svg, dots };
}
