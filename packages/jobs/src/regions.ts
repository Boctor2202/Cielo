/**
 * World regions for pilot jobs, with the licence regime and work authorisation they usually imply.
 * A European pilot typically holds an EASA licence and EU/EEA work rights: a US job needs an FAA licence
 * and US work authorisation, a UK job a UK CAA licence and UK right to work, and so on.
 */

export type RegionId = "EU" | "UK" | "US" | "CA" | "ME" | "APAC" | "AFRICA" | "LATAM" | "OTHER";
export type Authority = "EASA" | "UK CAA" | "FAA" | "TCCA" | "CASA" | "GCAA" | "GACA" | "QCAA" | "CAAC" | "DGCA" | "LOCAL";

export const REGIONS: RegionId[] = ["EU", "UK", "US", "CA", "ME", "APAC", "AFRICA", "LATAM", "OTHER"];

// EASA member states (EU 27 + Iceland, Liechtenstein, Norway, Switzerland)
const EASA = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH".split(" "));
const ME = new Set("AE QA SA BH KW OM JO IL LB IQ IR YE TR".split(" "));
const AFRICA = new Set("DZ AO BJ BW BF BI CM CV CF TD KM CG CD DJ EG GQ ER SZ ET GA GM GH GN GW CI KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW RE".split(" "));
const LATAM = new Set("MX GT BZ HN SV NI CR PA CU DO HT JM BS BB TT AR BO BR CL CO EC GY PY PE SR UY VE PR AW CW".split(" "));
const APAC = new Set("AU NZ JP KR CN HK MO TW SG MY TH VN PH ID IN PK BD LK NP MV MN KH LA MM BN FJ PG NC PF KZ UZ".split(" "));

export function regionOf(country?: string): RegionId {
  const c = (country ?? "").toUpperCase();
  if (!c) return "OTHER";
  if (EASA.has(c) || ["MC", "SM", "AD", "VA", "GI", "FO"].includes(c)) return "EU";
  if (c === "GB" || c === "JE" || c === "GG" || c === "IM") return "UK";
  if (c === "US") return "US";
  if (c === "CA") return "CA";
  if (ME.has(c)) return "ME";
  if (AFRICA.has(c)) return "AFRICA";
  if (LATAM.has(c)) return "LATAM";
  if (APAC.has(c)) return "APAC";
  return "OTHER";
}

/** Licence regime an employer in this country normally requires. */
export function authorityOf(country?: string): Authority {
  const c = (country ?? "").toUpperCase();
  if (EASA.has(c)) return "EASA";
  return ({ GB: "UK CAA", US: "FAA", CA: "TCCA", AU: "CASA", AE: "GCAA", SA: "GACA", QA: "QCAA", CN: "CAAC", IN: "DGCA" } as Record<string, Authority>)[c] ?? "LOCAL";
}

/** Maps what pilots write on their licence ("DGAC France", "FAA", "LBA"…) to a regime. */
export function authorityFromText(s?: string | null): Authority | undefined {
  const t = (s ?? "").toUpperCase();
  if (!t) return undefined;
  if (/EASA|DGAC|LBA|ENAC|AESA|ANAC|BAZL|FOCA|IAA|ILT|DCAA|TRAFIKVERKET|TRANSPORTSTYRELSEN|LUFTFARTSTILSYNET|ULC|CAA ?CZ|AUSTRO ?CONTROL|BCAA|DGTA|DGCA LU|HCAA|ACAA|LCAA|TRAFICOM|CAA NO|CAA IS/.test(t)) return "EASA";
  if (/UK ?CAA|^CAA$|UNITED KINGDOM/.test(t)) return "UK CAA";
  if (/FAA/.test(t)) return "FAA";
  if (/TCCA|TRANSPORT CANADA/.test(t)) return "TCCA";
  if (/CASA/.test(t)) return "CASA";
  if (/GCAA/.test(t)) return "GCAA";
  return undefined;
}

/** Default work rights implied by a licence regime (the pilot can change them). */
export function defaultWorkRegions(authorities: Authority[]): RegionId[] {
  const r = new Set<RegionId>();
  for (const a of authorities) {
    if (a === "EASA") r.add("EU");
    if (a === "UK CAA") r.add("UK");
    if (a === "FAA") r.add("US");
    if (a === "TCCA") r.add("CA");
  }
  return [...r];
}

const NAMES: Record<string, string> = {
  "united states": "US", usa: "US", "u.s.": "US", "united kingdom": "GB", uk: "GB", england: "GB", scotland: "GB", wales: "GB", "great britain": "GB",
  france: "FR", germany: "DE", deutschland: "DE", spain: "ES", "españa": "ES", italy: "IT", italia: "IT", netherlands: "NL", "the netherlands": "NL",
  belgium: "BE", "belgië": "BE", belgique: "BE", switzerland: "CH", schweiz: "CH", suisse: "CH", austria: "AT", "österreich": "AT", portugal: "PT", ireland: "IE",
  luxembourg: "LU", malta: "MT", denmark: "DK", sweden: "SE", norway: "NO", finland: "FI", iceland: "IS", poland: "PL", "czech republic": "CZ", czechia: "CZ",
  greece: "GR", cyprus: "CY", hungary: "HU", romania: "RO", bulgaria: "BG", croatia: "HR", slovenia: "SI", slovakia: "SK", estonia: "EE", latvia: "LV",
  lithuania: "LT", canada: "CA", mexico: "MX", brazil: "BR", "united arab emirates": "AE", uae: "AE", qatar: "QA", "saudi arabia": "SA", turkey: "TR",
  "türkiye": "TR", australia: "AU", "new zealand": "NZ", singapore: "SG", "hong kong": "HK", japan: "JP", china: "CN", india: "IN", "south africa": "ZA",
  morocco: "MA", egypt: "EG", kenya: "KE", nigeria: "NG", israel: "IL",
};
const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));

/** ISO country code from a feed's country field and/or free-text location ("Miami, FL, USA", "Hamburg", "Gatwick · United Kingdom"). */
export function countryFrom(country?: string, location?: string): string | undefined {
  const c = (country ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  if (c && NAMES[c.toLowerCase()]) return NAMES[c.toLowerCase()];
  const loc = (location ?? "").toLowerCase();
  if (!loc) return undefined;
  const parts = loc.split(/[,·|/()-]+/).map((s) => s.trim()).filter(Boolean);
  for (const p of parts.reverse()) {
    if (NAMES[p]) return NAMES[p];
    if (/^[a-z]{2}$/.test(p) && US_STATES.has(p.toUpperCase()) && /,\s*[a-z]{2}\b/.test(loc)) return "US";
  }
  for (const [name, code] of Object.entries(NAMES)) if (name.length > 3 && loc.includes(name)) return code;
  return undefined;
}
