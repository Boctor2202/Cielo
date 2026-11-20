// Builds the world time-zone map shared by the website and the app, from open data:
//   - zone boundaries: geo-tz (timezone-boundary-builder, ODbL, from OpenStreetMap)
//   - coastlines: world-atlas land-110m (Natural Earth, public domain)
// Outputs: a colour map (equirectangular, 2048 × 1024) coloured by standard UTC offset with the zone borders,
// the coastline as SVG paths, and a 1° grid of zones for "what time is it there?" on tap.
// Run from a folder with the build deps (geo-tz@8 world-atlas@2 topojson-client@3 pngjs@7):
//   node scripts/timezones/build.mjs <deps-folder> <repo-root>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [depsDir, root] = process.argv.slice(2);
const req = createRequire(join(depsDir, "package.json"));
const { find } = req("geo-tz");
const { PNG } = req("pngjs");
const topo = req("topojson-client");
const land = req("world-atlas/land-110m.json");

// latitudes 84°N to 60°S: the inhabited world, without the polar caps
const NORTH = 84, SOUTH = -60, SPAN = NORTH - SOUTH;
const W = 2048, H = Math.round((W * SPAN) / 360);
const JAN = new Date(Date.UTC(2026, 0, 15, 12));
const offsetCache = new Map();
/** Standard (winter, northern hemisphere) offset in minutes; for southern summer time, the smaller of Jan / Jul. */
function stdOffset(zone) {
  if (offsetCache.has(zone)) return offsetCache.get(zone);
  const off = (d) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(d).find((x) => x.type === "timeZoneName").value;
    const m = p.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  };
  const v = Math.min(off(JAN), off(new Date(Date.UTC(2026, 6, 15, 12))));
  offsetCache.set(zone, v);
  return v;
}

// zone and offset of every pixel (pixel centre)
const zoneIdx = new Map();
const zones = [];
const pix = new Int16Array(W * H);
const offs = new Int16Array(W * H);
for (let y = 0; y < H; y++) {
  const lat = NORTH - ((y + 0.5) / H) * SPAN;
  for (let x = 0; x < W; x++) {
    const lon = ((x + 0.5) / W) * 360 - 180;
    let z = find(Math.max(-89.9, Math.min(89.9, lat)), lon)[0] ?? "Etc/UTC";
    if (!zoneIdx.has(z)) { zoneIdx.set(z, zones.length); zones.push(z); }
    pix[y * W + x] = zoneIdx.get(z);
    offs[y * W + x] = stdOffset(z);
  }
}

// colours: a hue per offset, alternating lightness so neighbours stand apart; the zone borders lighter
const png = new PNG({ width: W, height: H });
const hsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x, o = offs[i];
  const hours = o / 60;
  const hue = (((hours + 12) / 26) * 300 + 190) % 360;
  const even = Math.round(hours) % 2 === 0;
  // land (named zones) in colour, the sea (Etc/GMT±N zones) in the same hue, dark
  const sea = zones[pix[i]].startsWith("Etc/");
  let [r, g, b] = sea ? hsl(hue, 0.35, even ? 0.16 : 0.12) : hsl(hue, 0.5, even ? 0.42 : 0.34);
  const right = x + 1 < W ? offs[i + 1] : o, down = y + 1 < H ? offs[i + W] : o;
  if (right !== o || down !== o) [r, g, b] = [205, 214, 228];
  const k = i * 4;
  png.data[k] = r; png.data[k + 1] = g; png.data[k + 2] = b; png.data[k + 3] = 255;
}
const pngBuf = PNG.sync.write(png, { colorType: 2 });

// coastline as SVG paths in a 360 × SPAN box (x = lon + 180, y = NORTH − lat)
const geo = topo.feature(land, land.objects.land);
const rings = [];
for (const f of geo.features ?? [geo]) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of polys)
    for (const ring of poly) {
      // a ring that crosses the date line is cut there (no stroke across the whole map)
      let d = "", prev = null;
      for (const [lo, la] of ring) {
        const cmd = prev === null || Math.abs(lo - prev) > 180 ? "M" : "L";
        d += `${cmd}${(lo + 180).toFixed(2)} ${(NORTH - la).toFixed(2)}`;
        prev = lo;
      }
      rings.push(d);
    }
}

// a 1° grid of zones (the zone at each cell centre) for a tap on the map
const grid = [];
for (let y = 0; y < SPAN; y++) for (let x = 0; x < 360; x++) {
  const z = find(NORTH - 0.5 - y, x - 179.5)[0] ?? "Etc/UTC";
  if (!zoneIdx.has(z)) { zoneIdx.set(z, zones.length); zones.push(z); }
  grid.push(zoneIdx.get(z));
}
const gridB64 = Buffer.from(Uint16Array.from(grid).buffer).toString("base64");

const json = { north: NORTH, south: SOUTH, attribution: "Time zones: timezone-boundary-builder (ODbL, © OpenStreetMap contributors). Coastline: Natural Earth.", zones, grid: gridB64, land: rings.join("") };
writeFileSync(join(root, "packages/reference-data/data/timezones.json"), JSON.stringify(json));
mkdirSync(join(root, "apps/web/public/data"), { recursive: true });
writeFileSync(join(root, "apps/web/public/data/timezones.png"), pngBuf);
writeFileSync(join(root, "apps/mobile/assets/timezones.png"), pngBuf);
console.log(`zones ${zones.length}, png ${(pngBuf.length / 1024).toFixed(0)} KB, json ${(JSON.stringify(json).length / 1024).toFixed(0)} KB`);
