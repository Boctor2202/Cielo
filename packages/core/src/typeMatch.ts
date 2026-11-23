/**
 * The ICAO type designator behind an aircraft written as a name in a logbook file ("172, P172, R172, Skyhawk",
 * "TB20, Socata Trinidad", "EMB 500", "PA-46-600TP, Piper M600"). Exports of some logbook apps carry the
 * manufacturer's model list instead of the designator: without it, statistics by type and the CV would show
 * those strings.
 */

type TypeRef = { icao: string; manufacturer: string; model: string };

/** Names the reference list does not spell out (marketing names, sub-models). */
const ALIASES: Record<string, string[]> = {
  P46T: ["M500", "M600", "M700", "500TP", "600TP", "701TP", "MERIDIAN"],
  PA46: ["MALIBU", "MIRAGE", "M350"],
  TBM7: ["TBM700", "700A", "700B", "700C2"],
  TBM8: ["TBM850", "700N"],
  TBM9: ["TBM900", "TBM910", "TBM930", "TBM940", "TBM960", "900", "910", "930", "940", "960"],
  E50P: ["EMB500", "PHENOM100"],
  E55P: ["EMB505", "PHENOM300"],
  B737: ["737700", "BBJ"],
  B738: ["737800", "BBJ2"],
};

/**
 * Words of a name: each word, its hyphen-free and space-free forms, its parts, and (for the logbook's text) a
 * number without its suffix letter ("340A" is a 340).
 */
function words(s: string, bare = false): Set<string> {
  const out = new Set<string>();
  const up = s.toUpperCase();
  for (const part of up.split(/[,/;()]+/)) {
    const compact = part.replace(/[^A-Z0-9]/g, "");
    if (compact.length >= 3) out.add(compact);
    for (const w of part.split(/\s+/).filter(Boolean)) {
      const c = w.replace(/[^A-Z0-9]/g, "");
      if (c) out.add(c);
      for (const p of w.split(/[^A-Z0-9]+/).filter(Boolean)) {
        out.add(p);
        const n = bare ? /^(\d{3,})[A-Z]{1,2}$/.exec(p)?.[1] : undefined;
        if (n) out.add(n);
      }
    }
  }
  // letters alone (C, B, XP) say nothing about a type
  for (const w of [...out]) if (w.length < 2 || (/^[A-Z]+$/.test(w) && w.length < 3)) out.delete(w);
  return out;
}

/**
 * @param prefer designators the pilot already flies: when the name fits several types equally ("900": TBM 900,
 * Falcon 900, CRJ-900), the one in this set
 */
export function typeFromText(text: string | null | undefined, types: TypeRef[], prefer?: Set<string>): string | undefined {
  if (!text?.trim()) return undefined;
  const byIcao = new Map(types.map((t) => [t.icao.toUpperCase(), t.icao]));
  const exact = byIcao.get(text.trim().toUpperCase());
  if (exact) return exact;
  const w = words(text, true);
  // a designator written among the names ("TB20, Socata Trinidad", "DA-42 TwinStar", "SR-22")
  for (const x of w) if (byIcao.has(x) && /\d/.test(x)) return byIcao.get(x);
  let best: { icao: string; score: number; strong: boolean } | undefined;
  let tied: string[] = [];
  for (const t of types) {
    const tw = words(`${t.manufacturer} ${t.model} ${(ALIASES[t.icao] ?? []).join(" ")}`);
    let score = 0;
    let strong = false;
    for (const x of tw) {
      if (!w.has(x)) continue;
      score += x.length;
      // longer shared words weigh more ("EMB500" over "500"); a model number (172, 960, DR400) points at a
      // type, a manufacturer alone does not
      if (/\d/.test(x) && x.length >= 3) strong = true;
    }
    if (!strong || score === 0) continue;
    if (!best || score > best.score) {
      best = { icao: t.icao, score, strong };
      tied = [t.icao];
    } else if (score === best.score && !tied.includes(t.icao)) tied.push(t.icao);
  }
  if (!best) return undefined;
  if (tied.length === 1) return best.icao;
  const mine = tied.filter((x) => prefer?.has(x));
  return mine.length === 1 ? mine[0] : undefined;
}

/**
 * Flights and aircraft saved with a name instead of a designator (imported before names were recognised): the
 * designator and model each should carry. Signed flights are left as signed.
 */
export function retypeLogbook<
  F extends { id: string; aircraftTypeIcao?: string | null; signatureId?: string | null; deletedAt?: string | null; isFstd?: boolean },
  A extends { id: string; aircraftTypeId: string; deletedAt?: string | null },
>(flights: F[], aircraft: A[], types: TypeRef[]): { flights: { id: string; icao: string; model: string }[]; aircraft: { id: string; typeId: string }[] } {
  const known = new Set(types.map((t) => t.icao.toUpperCase()));
  const byIcao = new Map(types.map((t) => [t.icao, t]));
  // the types the logbook already shows (known designators and names that resolve alone) settle the ambiguous names
  const prefer = new Set<string>();
  for (const f of flights) {
    const raw = f.aircraftTypeIcao?.trim();
    // a simulator session says nothing about the aircraft flown
    if (!raw || f.deletedAt || f.isFstd) continue;
    const x = known.has(raw.toUpperCase()) ? types.find((t) => t.icao.toUpperCase() === raw.toUpperCase())?.icao : typeFromText(raw, types);
    if (x) prefer.add(x);
  }
  const memo = new Map<string, string | undefined>();
  const resolve = (raw: string) => {
    if (!memo.has(raw)) memo.set(raw, typeFromText(raw, types, prefer));
    return memo.get(raw);
  };
  const outF: { id: string; icao: string; model: string }[] = [];
  for (const f of flights) {
    const raw = f.aircraftTypeIcao?.trim();
    if (f.deletedAt || f.signatureId || !raw || known.has(raw.toUpperCase())) continue;
    const icao = resolve(raw);
    const t = icao ? byIcao.get(icao) : undefined;
    if (t) outF.push({ id: f.id, icao: t.icao, model: `${t.manufacturer} ${t.model}` });
  }
  const outA: { id: string; typeId: string }[] = [];
  for (const a of aircraft) {
    const raw = /^ref-(.+)$/.exec(a.aircraftTypeId)?.[1];
    if (a.deletedAt || !raw || known.has(raw.toUpperCase())) continue;
    const icao = resolve(raw);
    if (icao) outA.push({ id: a.id, typeId: `ref-${icao}` });
  }
  return { flights: outF, aircraft: outA };
}
