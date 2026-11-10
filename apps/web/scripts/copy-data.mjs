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
