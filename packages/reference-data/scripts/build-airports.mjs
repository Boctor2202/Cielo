// Builds a compact airport table from OurAirports (public domain): https://ourairports.com/data/
// Usage: node scripts/build-airports.mjs <airports.csv> <out.json>
import fs from "node:fs";
import Papa from "papaparse";
import tzlookup from "tz-lookup";

const [, , input, output] = process.argv;
const { data } = Papa.parse(fs.readFileSync(input, "utf8"), { header: true, skipEmptyLines: true });
const KEEP = new Set(["large_airport", "medium_airport", "small_airport", "seaplane_base"]);
const rows = [];
const seen = new Set();
for (const a of data) {
  if (!KEEP.has(a.type)) continue;
  const icao = (a.icao_code || a.gps_code || "").trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao) || seen.has(icao)) continue;
  const lat = Number(a.latitude_deg), lon = Number(a.longitude_deg);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  let tz = "";
  try { tz = tzlookup(lat, lon); } catch {}
  seen.add(icao);
  rows.push([icao, a.iata_code || "", a.name, a.municipality || "", a.iso_country, +lat.toFixed(4), +lon.toFixed(4), a.elevation_ft ? Number(a.elevation_ft) : null, tz, a.type === "large_airport" ? 3 : a.type === "medium_airport" ? 2 : 1]);
}
rows.sort((x, y) => y[9] - x[9] || x[0].localeCompare(y[0]));
fs.writeFileSync(output, JSON.stringify({ source: "OurAirports (public domain)", generatedAt: new Date().toISOString().slice(0, 10), fields: ["icao", "iata", "name", "city", "country", "lat", "lon", "elevationFt", "timezone", "size"], rows }));
console.log(`${rows.length} airports -> ${output}`);
