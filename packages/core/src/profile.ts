/** The pilot's first name for a greeting, from the profile only: the display name, else the full name's first word. */
export function pilotFirstName(p: { displayName?: string | null; fullName?: string | null } | undefined): string | undefined {
  const word = (s?: string | null) => s?.trim().split(/\s+/)[0] || undefined;
  return word(p?.displayName) ?? word(p?.fullName);
}

/** Part of the day for a greeting, in the device's local time: morning 05:00–11:59, afternoon 12:00–17:59, else evening. */
export function dayPart(d: Date = new Date()): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 18 ? "afternoon" : "evening";
}

/**
 * Stripes on the pilot's epaulette, from the rank as typed: 4 for a captain, 3 for a first officer, 2 for a
 * second officer or a student. Undefined when the rank does not say.
 */
export function rankStripes(rank?: string | null): 2 | 3 | 4 | undefined {
  const r = (rank ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!r.trim()) return undefined;
  if (/\b(captain|commander|commandant|cdb|cmdr|capt|pic)\b/.test(r) && !/first officer/.test(r)) return 4;
  if (/first officer|\bf\/?o\b|\bsfo\b|\bopl\b|officier pilote|copilot|co-pilot|copilote/.test(r)) return 3;
  if (/second officer|\bs\/?o\b|student|eleve|cadet|trainee/.test(r)) return 2;
  return undefined;
}

/** Age in whole years on a day (both YYYY-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** The flag emoji of an ISO 3166-1 alpha-2 country. */
export const flagEmoji = (cc?: string | null) =>
  cc && /^[A-Za-z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "";

type Doc = { kind: string; code: string; validUntil?: string | null; issuedOn?: string | null; number?: string; authority?: string; deletedAt?: string | null };
const valid = (d: Doc, today: string) => !d.deletedAt && (!d.validUntil || d.validUntil >= today);
/** the latest document of a kind: valid first, then the one valid the longest */
const latest = <D extends Doc>(docs: D[], kind: (k: string) => boolean, today: string) =>
  docs
    .filter((d) => !d.deletedAt && kind(d.kind))
    .sort((a, b) => Number(valid(b, today)) - Number(valid(a, today)) || (b.validUntil ?? "9999").localeCompare(a.validUntil ?? "9999"))[0];

const LICENCE_RANK = ["ATPL", "MPL", "CPL", "PPL", "LAPL", "SPL", "BPL"];

/** The pilot's main documents, from the Licences page: the highest licence, the medical, the language proficiency. */
export function pilotCredentials<D extends Doc>(docs: D[], today: string): { licence?: D; medical?: D; language?: D } {
  const licences = docs.filter((d) => !d.deletedAt && d.kind === "licence");
  const rank = (d: D) => {
    const i = LICENCE_RANK.findIndex((x) => d.code.toUpperCase().startsWith(x));
    return i < 0 ? 99 : i;
  };
  const licence = [...licences].sort((a, b) => rank(a) - rank(b) || Number(valid(b, today)) - Number(valid(a, today)))[0];
  return { licence, medical: latest(docs, (k) => k === "medical", today), language: latest(docs, (k) => k === "language", today) };
}

/**
 * Current types the app can suggest: valid type ratings (their designator, "TR A320" → "A320") and the types
 * flown in the last 90 days, most recent first.
 */
export function suggestedCurrentTypes(
  docs: Doc[],
  flights: { date: string; aircraftTypeIcao?: string | null; deletedAt?: string | null; isFstd?: boolean }[],
  today: string,
): string[] {
  const out: string[] = [];
  const add = (x?: string | null) => {
    const v = (x ?? "").trim().toUpperCase();
    // a type designator, not a class rating (SEP, MEP, SET, TMG…)
    if (v && v.length <= 6 && !/^(SEP|MEP|SET|MET|SES|MES|TMG|SPL|IR|NVFR)$/.test(v) && !out.includes(v)) out.push(v);
  };
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 90 * 86_400_000).toISOString().slice(0, 10);
  [...flights]
    .filter((f) => !f.deletedAt && !f.isFstd && f.date >= since && f.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((f) => add(f.aircraftTypeIcao));
  for (const d of docs) if ((d.kind === "type_rating" || d.kind === "rating") && valid(d, today)) add(d.code.replace(/^(TR|TYPE RATING)\s*/i, "").split(/[\s/(]/)[0]);
  return out;
}
