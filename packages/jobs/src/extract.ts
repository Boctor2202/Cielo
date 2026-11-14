import { detectAircraft } from "./aircraft";
import type { LicenceLevel, Position, Requirements, Salary } from "./types";

/**
 * Turns a posting into structured facts (position, aircraft, required experience, salary).
 * Works on English, French and German ads. Only the extracted facts are kept.
 */

const num = (s: string) => {
  const t = s.replace(/[\s'’]/g, "").replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  const k = /k$/i.test(t);
  const v = parseFloat(t.replace(/k$/i, ""));
  return Number.isFinite(v) ? (k ? v * 1000 : v) : NaN;
};

export function detectPosition(title: string, text = ""): Position {
  const t = title.toLowerCase();
  // "First Officer / Captain" ads are listed as FO (entry seat); the captain seat is mentioned in the details
  if (/\b(first officer|copilot|co-pilot|copilote)\b/.test(t) && /\b(captain|commandant)\b/.test(t)) return "FO";
  if (/\b(captain|commandant|kapit[aä]n|cdb|commander|pic)\b/.test(t)) return "CPT";
  if (/\b(second officer|sop?\b)/.test(t)) return "SO";
  if (/\b(first officer|copilot|co-pilot|copilote|officier pilote|opl|f\/o|fo\b|erster offizier)\b/.test(t)) return "FO";
  if (/\b(cadet|trainee pilot|[eé]l[eè]ve pilote|ab[- ]initio)\b/.test(t)) return "CADET";
  if (/\b(instructor|instructeur|fi\b|tri\b|tre\b|sfi\b|fluglehrer)\b/.test(t)) return "FI";
  if (/\bpilot|pilote\b/.test(t)) return /captain|commandant/i.test(text) ? "CPT" : "FO";
  return "OTHER";
}

export function isPilotJob(title: string): boolean {
  return /\b(pilot|pilote|first officer|captain|commandant|copilot|co-pilot|copilote|second officer|cadet|flight instructor|instructeur pilote|type rated|kapit[aä]n|erster offizier|flugkapit[aä]n)\b/i.test(title) &&
    !/\b(drone|uav|rpas|ground|dispatcher|cabin|flight attendant|steward|engineer|technician|mechanic|recruit(er|ment)|assistant|coordinator|scheduler|planner|trainer \(ground\))\b/i.test(title);
}

function licence(text: string): { licence?: LicenceLevel; authority?: string } {
  const out: { licence?: LicenceLevel; authority?: string } = {};
  if (/\bfrozen ?ATPL\b|\bATPL ?(?:theory|theoretical|th[eé]orique|credits?)\b|\bATPL\(?\s?A?\)? frozen\b/i.test(text)) out.licence = "FATPL";
  else if (/\bATPL\b/i.test(text)) out.licence = "ATPL";
  else if (/\bMPL\b/.test(text)) out.licence = "MPL";
  else if (/\bCPL\b/i.test(text)) out.licence = "CPL";
  const auth = text.match(/\b(EASA|FAA|UK CAA|CAA|TCCA|CASA|GCAA|DGAC)\b/i);
  if (auth) out.authority = auth[1]!.toUpperCase();
  return out;
}

/**
 * Hours: every "<number> h/hrs/hours/heures/Stunden" with ~60 chars of context, classified by nearby words.
 * The first figure per category wins (ads list minimums first).
 */
function hours(text: string): Partial<Requirements> {
  const out: Partial<Requirements> = {};
  const re = /(\d{1,2}[ ,.’']?\d{3}|\d{2,5})\s*\+?\s*(?:(?:total|flight|flying|de vol|logged)\s+){0,2}(?:h\b|hrs?\b|hours?\b|heures?\b|hdv\b|flugstunden|stunden|std\.?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = num(m[1]!);
    if (!Number.isFinite(n) || n < 50 || n > 30000) continue;
    const before = text.slice(Math.max(0, m.index - 70), m.index).toLowerCase();
    // context stops at the next figure or clause break, so "2,000 h total, including 1,000 on jet" stays two facts
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 50).toLowerCase().split(/[\d,;•\n]|including|dont|davon|of which/)[0] ?? "";
    const near = `${before} ${after}`;
    const set = (k: keyof Requirements) => {
      if ((out as Record<string, unknown>)[k] === undefined) (out as Record<string, number>)[k] = n;
    };
    if (/\b(pic|command|commandant|cdb|captain|p1)\b/.test(after) || /\b(pic|in command|as captain|als kapit)/.test(before.slice(-30))) set("picHours");
    else if (/\bon type\b|sur type|auf (dem )?muster|on the type|on (a|the)? ?(a3[2-5]0|b7\d7|atr|q400|citation|global|falcon|pc-?24)/.test(near)) set("onTypeHours");
    else if (/\bjet\b/.test(after)) set("jetHours");
    else if (/turbine|turbo/.test(after)) set("turbineHours");
    else if (/multi[- ]?(pilot|crew)|\bmcc\b|multi[- ]?engine|\bmep\b|\bme\b/.test(after)) set("multiPilotHours");
    else set("totalHours");
  }
  // "including 1,000 on jet aircraft" — a figure with no "h" right after it
  const incl = text.match(/including\s+(\d[\d,. ]{2,6})\s+(?:hours?\s+)?on\s+(jet|turbine|type|multi)/i);
  if (incl) {
    const n = num(incl[1]!);
    const k = incl[2]!.toLowerCase();
    const key: keyof Requirements = k === "jet" ? "jetHours" : k === "turbine" ? "turbineHours" : k === "type" ? "onTypeHours" : "multiPilotHours";
    if ((out as Record<string, unknown>)[key] === undefined && Number.isFinite(n)) (out as Record<string, number>)[key] = n;
  }
  return out;
}

export function extractRequirements(title: string, text: string): Requirements {
  const all = `${title}\n${text}`;
  const req: Requirements = { ...licence(all), ...hours(text) };
  const provided = /\b(type rating (?:is )?(?:provided|offered|sponsored|financed|paid|included)|we (?:will )?(?:provide|offer|finance|sponsor) (?:the |a |your )?type rating|non[- ]type[- ]rated|non[- ]?TR\b|qualification de type (?:offerte|financ[ée]e|prise en charge)|type rating (?:will be|can be) (?:provided|financed|arranged))/i.test(all);
  const required = /\b(type rated|current on type|valid type rating|type rating(?: on [^.\n]{0,30})?(?: is)? (?:required|mandatory|essential)|type rating:|tr (?:required|valid)|qualifi[ée] sur|qualification de type (?:valide|requise|exig[ée]e)|g[üu]ltige(?:s)? (?:type rating|musterberechtigung))/i.test(all);
  if (provided) req.typeRatingProvided = true;
  if (required && !provided) req.typeRatingRequired = true;
  const lvl = all.match(/(?:ICAO|English)[^.\n]{0,25}level\s*([4-6])|level\s*([4-6])\s*(?:english|icao)/i);
  if (lvl) req.englishLevel = Number(lvl[1] ?? lvl[2]);
  return req;
}

/** Fixed, indicative conversion rates to EUR (sorting only; the original currency is always shown). */
const TO_EUR: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.04, CAD: 0.68, AUD: 0.61, SEK: 0.087, NOK: 0.085, DKK: 0.134, PLN: 0.23, CZK: 0.04, AED: 0.25, HUF: 0.0025 };
const CUR: [RegExp, string][] = [[/€|\beur\b|euros?/i, "EUR"], [/\$\s?|usd|us\$/i, "USD"], [/£|gbp/i, "GBP"], [/\bchf\b/i, "CHF"], [/\bsek\b/i, "SEK"], [/\bnok\b/i, "NOK"], [/\bdkk\b/i, "DKK"], [/\bpln\b|zł/i, "PLN"], [/\baed\b/i, "AED"]];

function period(s: string): Salary["period"] {
  if (/hour|heure|stunde|\/h\b/i.test(s)) return "hour";
  if (/day|jour|tag|per diem/i.test(s)) return "day";
  if (/month|mois|monat|monthly|mensuel|\/m\b|p\.?m\.?\b/i.test(s)) return "month";
  return "year";
}

function annual(v: number, p: Salary["period"]) {
  return p === "year" ? v : p === "month" ? v * 12 : p === "day" ? v * 200 : v * 1600;
}

export function finishSalary(min: number | undefined, max: number | undefined, currency: string, p: Salary["period"]): Salary | undefined {
  if (!min && !max) return undefined;
  const mid = min && max ? (min + max) / 2 : (min ?? max)!;
  const rate = TO_EUR[currency];
  return { min, max, currency, period: p, annualEur: rate ? Math.round(annual(mid, p) * rate) : undefined };
}

/** Salary stated in the text, e.g. "€6,500 – 8,000 per month", "£85k-£95k p.a.", "CHF 9'500 brutto/Monat". */
export function extractSalary(text: string): Salary | undefined {
  const re = /(€|£|\$|eur|usd|gbp|chf|sek|nok|dkk|pln|aed)?\s?(\d{1,3}(?:[ ,.’']\d{3})+|\d+(?:[.,]\d+)?\s?k)\s?(€|£|\$|eur|usd|gbp|chf|sek|nok|dkk|pln|aed|euros?)?(?:\s?(?:-|–|to|à|bis)\s?(€|£|\$|eur|usd|gbp|chf)?\s?(\d{1,3}(?:[ ,.’']\d{3})+|\d+(?:[.,]\d+)?\s?k)\s?(€|£|\$|eur|usd|gbp|chf|euros?)?)?([^.\n]{0,40})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const curTxt = m[1] ?? m[3] ?? m[4] ?? m[6];
    if (!curTxt) continue;
    const ctx = text.slice(Math.max(0, m.index - 60), m.index).toLowerCase() + " " + (m[7] ?? "");
    if (!/salar|salaire|gehalt|pay\b|remuneration|r[ée]mun[ée]ration|compensation|brutto|gross|brut|package|per (?:month|year|annum)|p\.?a\.?|\/(?:month|year|mois|an)|par (?:mois|an)/i.test(ctx)) continue;
    const currency = CUR.find(([r]) => r.test(curTxt))?.[1];
    if (!currency) continue;
    const a = num(m[2]!.replace(/\s/g, ""));
    const b = m[5] ? num(m[5].replace(/\s/g, "")) : undefined;
    if (!Number.isFinite(a) || a < 15) continue;
    const p = period(m[7] ?? ctx);
    const lo = b && Number.isFinite(b) ? Math.min(a, b) : a;
    const hi = b && Number.isFinite(b) ? Math.max(a, b) : undefined;
    // sanity: plausible pilot pay
    const yearly = annual(hi ?? lo, p) * (TO_EUR[currency] ?? 1);
    if (yearly < 15000 || yearly > 600000) continue;
    return finishSalary(lo, hi, currency, p);
  }
  return undefined;
}

export function extractAircraft(title: string, text: string): string[] {
  const fromTitle = detectAircraft(title);
  return fromTitle.length ? fromTitle : detectAircraft(text.slice(0, 1500));
}
