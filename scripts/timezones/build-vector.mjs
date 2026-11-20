// The time zones as polygons (one MultiPolygon per UTC offset), for zoomable maps (Google Maps on the website,
// Apple / Google maps in the app). Traced from a 0.1° grid of geo-tz (timezone-boundary-builder, ODbL), simplified.
//   node scripts/timezones/build-vector.mjs <deps-folder> <repo-root>
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const [depsDir, root] = process.argv.slice(2);
const req = createRequire(join(depsDir, "package.json"));
const { find } = req("geo-tz");
const { contours } = req("d3-contour");
const simplify = req("simplify-js");

const STEP = 0.1, NORTH = 85, SOUTH = -85;
const W = Math.round(360 / STEP), H = Math.round((NORTH - SOUTH) / STEP);
const JAN = new Date(Date.UTC(2026, 0, 15, 12)), JUL = new Date(Date.UTC(2026, 6, 15, 12));
const cache = new Map();
const off = (zone, d) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(d).find((x) => x.type === "timeZoneName").value;
  const m = p.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
};
const std = (z) => { if (!cache.has(z)) cache.set(z, Math.min(off(z, JAN), off(z, JUL))); return cache.get(z); };

const offs = new Int16Array(W * H);
for (let y = 0; y < H; y++) {
  const lat = NORTH - (y + 0.5) * STEP;
  for (let x = 0; x < W; x++) offs[y * W + x] = std(find(lat, -180 + (x + 0.5) * STEP)[0] ?? "Etc/UTC");
}
const values = [...new Set(offs)].sort((a, b) => a - b);
const features = [];
let points = 0;
for (const v of values) {
  const mask = new Float64Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = offs[i] === v ? 1 : 0;
  const [mp] = contours().size([W, H]).smooth(false).thresholds([0.5])(mask);
  const polys = [];
  for (const poly of mp.coordinates) {
    const rings = poly
      .map((ring) => simplify(ring.map(([x, y]) => ({ x: -180 + x * STEP, y: NORTH - y * STEP })), 0.06, true).map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]))
      .filter((r) => r.length >= 4);
    if (rings.length) { polys.push(rings); points += rings.reduce((s, r) => s + r.length, 0); }
  }
  if (polys.length) features.push({ type: "Feature", properties: { offset: v }, geometry: { type: "MultiPolygon", coordinates: polys } });
}
const geo = { type: "FeatureCollection", attribution: "Time zones: timezone-boundary-builder (ODbL, © OpenStreetMap contributors)", features };
const s = JSON.stringify(geo);
writeFileSync(join(root, "apps/web/public/data/timezones.geojson"), s);
writeFileSync(join(root, "packages/reference-data/data/timezones-polygons.json"), s);
console.log(`${features.length} offsets, ${points} points, ${(s.length / 1024).toFixed(0)} KB`);
