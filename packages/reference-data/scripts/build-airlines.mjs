// Builds a compact airline table from OpenFlights (Open Database License): https://openflights.org/data
// Usage: node scripts/build-airlines.mjs <airlines.dat> <out.json>
import fs from "node:fs";
import Papa from "papaparse";

const [, , input, output] = process.argv;
const { data } = Papa.parse(fs.readFileSync(input, "utf8"), { header: false, skipEmptyLines: true });
const clean = (s) => (s && s !== "\\N" && s !== "-" && s !== "N/A" ? String(s).trim() : "");
const byIcao = new Map();
const rest = [];
for (const r of data) {
  const [, name, , iata, icao, callsign, country, active] = r.map(clean);
  if (!name || name === "Unknown" || name === "Private flight") continue;
  const code = /^[A-Z]{3}$/.test(icao) ? icao : "";
  const iataCode = /^[A-Z0-9]{2}$/.test(iata) ? iata : "";
  if (!code && !iataCode) continue;
  const row = [code, iataCode, name, callsign, country, active === "Y" ? 1 : 0];
  if (!code) rest.push(row);
  // one per designator: the active airline wins over the defunct ones that held it
  else if (!byIcao.has(code) || (row[5] && !byIcao.get(code)[5])) byIcao.set(code, row);
}
const rows = [...byIcao.values(), ...rest].sort((a, b) => b[5] - a[5] || a[2].localeCompare(b[2]));
fs.writeFileSync(output, JSON.stringify({ source: "OpenFlights airlines (Open Database License, openflights.org)", generatedAt: new Date().toISOString().slice(0, 10), fields: ["icao", "iata", "name", "callsign", "country", "active"], rows }));
console.log(`${rows.length} airlines -> ${output}`);
