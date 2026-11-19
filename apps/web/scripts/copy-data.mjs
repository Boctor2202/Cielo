import fs from "node:fs";
import path from "node:path";
const src = path.resolve("../../packages/reference-data/data/airports.json");
const dst = path.resolve("public/data/airports.json");
fs.mkdirSync(path.dirname(dst), { recursive: true });
if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(src).mtimeMs) fs.copyFileSync(src, dst);

// MapLibre spawns its worker from a URL relative to its own module, which bundlers rewrite: serve it statically.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mlDir = path.dirname(require.resolve("maplibre-gl/package.json"));
const worker = path.join(mlDir, "dist/maplibre-gl-worker.mjs");
const workerDst = path.resolve("public/vendor/maplibre-gl-worker.mjs");
fs.mkdirSync(path.dirname(workerDst), { recursive: true });
fs.copyFileSync(worker, workerDst);

// Light dataset for the 3D globe on the home page: a spatially thinned set of aerodromes (lat, lon).
const globeDst = path.resolve("public/data/globe-dots.json");
if (!fs.existsSync(globeDst) || fs.statSync(globeDst).mtimeMs < fs.statSync(src).mtimeMs) {
  const { rows } = JSON.parse(fs.readFileSync(src, "utf8"));
  const seen = new Set();
  const dots = [];
  for (const r of rows) {
    const lat = r[5], lon = r[6];
    const cell = `${Math.round(lat / 1.4)}:${Math.round((lon * Math.cos((lat * Math.PI) / 180)) / 1.4)}`;
    if (seen.has(cell)) continue;
    seen.add(cell);
    dots.push(Math.round(lat * 10) / 10, Math.round(lon * 10) / 10);
  }
  fs.writeFileSync(globeDst, JSON.stringify(dots));
}

// Runway thresholds, for the radar to tell which runways the live traffic uses.
const rwySrc = path.resolve("../../packages/reference-data/data/runways.json");
const rwyDst = path.resolve("public/data/runways.json");
if (!fs.existsSync(rwyDst) || fs.statSync(rwyDst).mtimeMs < fs.statSync(rwySrc).mtimeMs) fs.copyFileSync(rwySrc, rwyDst);

// Airlines of the world (OpenFlights), for the operator search.
const alSrc = path.resolve("../../packages/reference-data/data/airlines.json");
const alDst = path.resolve("public/data/airlines.json");
if (!fs.existsSync(alDst) || fs.statSync(alDst).mtimeMs < fs.statSync(alSrc).mtimeMs) fs.copyFileSync(alSrc, alDst);
