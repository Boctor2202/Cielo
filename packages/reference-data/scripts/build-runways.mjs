// Builds a compact runway table from OurAirports (public domain): https://ourairports.com/data/runways.csv
// Usage: node scripts/build-runways.mjs <runways.csv> <airports.json> <out.json>
// Keeps open, hard or grass runways of the aerodromes in airports.json (size 2 and 3: those that publish METARs).
// Each runway end: [ident, true heading (deg), length ft]. When the heading is missing it comes from the
// opposite end or from the runway number (magnetic, close enough to pick the runway facing the wind).
import fs from "node:fs";
import Papa from "papaparse";

const [, , input, airportsFile, output] = process.argv;
const airports = JSON.parse(fs.readFileSync(airportsFile, "utf8"));
const keep = new Set(airports.rows.filter((r) => r[9] >= 2).map((r) => r[0]));
const { data } = Papa.parse(fs.readFileSync(input, "utf8"), { header: true, skipEmptyLines: true });
const out = {};
const num = (v) => (v === "" || v == null ? null : Number(v));
const fromIdent = (id) => {
  const n = parseInt(id, 10);
  return n >= 1 && n <= 36 ? (n * 10) % 360 : null;
};
for (const r of data) {
  const icao = r.airport_ident;
  if (!keep.has(icao) || r.closed === "1") continue;
  if (/^H/i.test(r.le_ident) || /WATER|WAT/i.test(r.surface)) continue;
  const len = num(r.length_ft) ?? 0;
  let le = num(r.le_heading_degT);
  let he = num(r.he_heading_degT);
  if (le == null && he != null) le = (he + 180) % 360;
  if (he == null && le != null) he = (le + 180) % 360;
  le ??= fromIdent(r.le_ident);
  he ??= fromIdent(r.he_ident);
  const ends = [];
  if (r.le_ident && le != null) ends.push([r.le_ident, Math.round(le), len]);
  if (r.he_ident && he != null) ends.push([r.he_ident, Math.round(he), len]);
  if (ends.length) (out[icao] ??= []).push(...ends);
}
fs.writeFileSync(output, JSON.stringify({ source: "OurAirports (public domain)", generatedAt: new Date().toISOString().slice(0, 10), fields: ["ident", "headingTrue", "lengthFt"], airports: out }));
console.log(`${Object.keys(out).length} aerodromes -> ${output} (${fs.statSync(output).size} bytes)`);
