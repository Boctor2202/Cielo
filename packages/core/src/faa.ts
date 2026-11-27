import { AC_61_65K, type AcEndorsementTemplate } from "./ac6165k";
import type { AircraftType, Endorsement, Flight } from "./types";

/* ---------- Endorsements (AC 61-65K) ---------- */

export const endorsementTemplate = (id: string): AcEndorsementTemplate | undefined => AC_61_65K.find((t) => t.id === id);

/** The template's text with the endorsed pilot and the aircraft filled in; the other [brackets] stay to fill. */
export function fillEndorsement(text: string, v: { studentName?: string; aircraft?: string }): string {
  let s = text;
  if (v.studentName?.trim()) s = s.replace(/\[First [Nn]ame, MI, Last [Nn]ame\]/g, v.studentName.trim()).replace(/\[pilot name\]/g, v.studentName.trim());
  if (v.aircraft?.trim()) s = s.replace(/\[make and model \(M\/M\)\]|\[M\/M\]/g, v.aircraft.trim());
  return s;
}

/** The [brackets] left to fill before the endorsement can be signed. */
export const blanksLeft = (text: string): string[] => [...text.matchAll(/\[[^\]]{1,200}\]/g)].map((m) => m[0]);

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Last day of the month `n` calendar months after the month of `iso`. */
const endOfMonthAfter = (iso: string, n: number) => {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + n + 1, 0, 12));
  return d.toISOString().slice(0, 10);
};

/**
 * How long an endorsement allows the privilege it gives, from its date:
 *  - solo (A.6, A.7) and night solo (A.5): flights within the 90 days after it (14 CFR 61.87(n), (o), (p));
 *  - flight review (A.69): until the end of the 24th calendar month after it (14 CFR 61.56(c)).
 * Other endorsements have no end date of their own.
 */
export function endorsementValidUntil(templateId: string, issuedOn: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) return null;
  if (templateId === "A.5" || templateId === "A.6" || templateId === "A.7") return addDays(issuedOn, 90);
  if (templateId === "A.69") return endOfMonthAfter(issuedOn, 24);
  return null;
}

/** "/s/ 11-27-2026 J. J. Jones 987654321CFI RE 12-31-2026": the signature line of AC 61-65K, Appendix A. */
export function endorsementSignatureLine(e: Pick<Endorsement, "issuedOn" | "instructorName" | "instructorCertificate" | "instructorCertKind" | "instructorCertDate">): string {
  const us = (iso?: string | null) => (iso ? `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}` : "");
  const cert = (e.instructorCertificate ?? "").trim();
  const tail = e.instructorCertKind && e.instructorCertDate ? ` ${e.instructorCertKind === "RE" ? "RE" : "Exp."} ${us(e.instructorCertDate)}` : "";
  return `/s/ ${us(e.issuedOn)} ${(e.instructorName ?? "").trim()} ${cert}${tail}`.replace(/\s+/g, " ").trim();
}

/** What the signature seals: a change to any of these after signing shows. */
export function canonicalEndorsement(e: Pick<Endorsement, "templateId" | "text" | "studentName" | "issuedOn" | "instructorName" | "instructorCertificate" | "instructorCertKind" | "instructorCertDate">): string {
  return JSON.stringify(["endorsement/1", e.templateId, e.text, e.studentName, e.issuedOn, e.instructorName ?? "", e.instructorCertificate ?? "", e.instructorCertKind ?? "", e.instructorCertDate ?? ""]);
}

/* ---------- FAA Form 8710-1, III. Record of Pilot Time ---------- */

export type Row8710 = "airplanes" | "rotorcraft" | "poweredLift" | "gliders" | "lighterThanAir" | "ffs" | "ftd" | "atd";
export const ROWS_8710: Row8710[] = ["airplanes", "rotorcraft", "poweredLift", "gliders", "lighterThanAir", "ffs", "ftd", "atd"];

export interface Cells8710 {
  total: number;
  instructionReceived: number;
  solo: number;
  pic: number;
  sic: number;
  xcInstruction: number;
  xcSolo: number;
  xcPic: number;
  xcSic: number;
  instrument: number;
  nightInstruction: number;
  /** counts (take-offs and landings at night) */
  nightToLdg: number;
  nightPic: number;
  nightSic: number;
  nightToLdgPic: number;
  nightToLdgSic: number;
  flights: number;
}

export interface Report8710 {
  rows: Record<Row8710, Cells8710>;
  /** airplane class totals (time in the class): SEL, MEL, SES, MES */
  classes: { cls: "SEL" | "MEL" | "SES" | "MES"; total: number; pic: number; sic: number }[];
  /** flights left out: aircraft category unknown */
  unknown: number;
}

const zero = (): Cells8710 => ({ total: 0, instructionReceived: 0, solo: 0, pic: 0, sic: 0, xcInstruction: 0, xcSolo: 0, xcPic: 0, xcSic: 0, instrument: 0, nightInstruction: 0, nightToLdg: 0, nightPic: 0, nightSic: 0, nightToLdgPic: 0, nightToLdgSic: 0, flights: 0 });

/** The simulator row of a session: FFS (full flight simulator), FTD, or ATD (BATD, AATD, FNPT, PCATD…). */
export function deviceRow(fstdType?: string): "ffs" | "ftd" | "atd" {
  const t = (fstdType ?? "").toUpperCase();
  if (/FFS|FULL FLIGHT|LEVEL [A-D]\b|\bSIM\b/.test(t)) return "ffs";
  if (/FTD/.test(t)) return "ftd";
  return "atd";
}

/**
 * The pilot time of the logbook in the rows and columns of FAA Form 8710-1 section III, in minutes (counts for
 * take-offs/landings and flights). Cross-country and night time are split by function the way the form asks
 * (instruction received, solo, PIC, SIC) from each flight's own times. PICUS is not an FAA function: it is left
 * out of the PIC column. Instrument = actual + simulated instrument time.
 */
export function report8710(flights: Flight[], types: AircraftType[]): Report8710 {
  const rows = Object.fromEntries(ROWS_8710.map((r) => [r, zero()])) as Record<Row8710, Cells8710>;
  const cls = new Map<"SEL" | "MEL" | "SES" | "MES", { total: number; pic: number; sic: number }>();
  const typeOf = new Map(types.map((t) => [t.icao.toUpperCase(), t]));
  let unknown = 0;
  for (const f of flights) {
    if (f.deletedAt) continue;
    if (f.isFstd) {
      const c = rows[deviceRow(f.fstdType)];
      c.total += f.fstdMin;
      c.instructionReceived += f.dualMin;
      c.instrument += f.simInstrumentMin ?? 0;
      c.flights++;
      continue;
    }
    const t = f.aircraftTypeIcao ? typeOf.get(f.aircraftTypeIcao.toUpperCase()) : undefined;
    const row: Row8710 | undefined = !t
      ? undefined
      : t.category === "airplane" || t.category === "tmg" || t.category === "ulm"
        ? "airplanes"
        : t.category === "helicopter"
          ? "rotorcraft"
          : t.category === "glider"
            ? "gliders"
            : t.category === "balloon" || t.category === "airship"
              ? "lighterThanAir"
              : undefined;
    if (!row) {
      unknown++;
      continue;
    }
    const c = rows[row];
    const solo = f.soloMin ?? 0;
    const min = (a: number, b: number) => Math.min(a, b);
    c.total += f.totalMin;
    c.instructionReceived += f.dualMin;
    c.solo += solo;
    c.pic += f.picMin;
    c.sic += f.copilotMin;
    c.xcInstruction += min(f.xcMin, f.dualMin);
    c.xcSolo += min(f.xcMin, solo);
    c.xcPic += min(f.xcMin, f.picMin);
    c.xcSic += min(f.xcMin, f.copilotMin);
    c.instrument += f.actualImcMin + (f.simInstrumentMin ?? 0);
    c.nightInstruction += min(f.nightMin, f.dualMin);
    const nightOps = Math.max(f.takeoffsNight, f.landingsNight);
    c.nightToLdg += nightOps;
    c.nightPic += min(f.nightMin, f.picMin);
    c.nightSic += min(f.nightMin, f.copilotMin);
    if (f.picMin > 0) c.nightToLdgPic += nightOps;
    else if (f.copilotMin > 0) c.nightToLdgSic += nightOps;
    c.flights++;
    if (row === "airplanes" && t) {
      const sea = /\bSEA|\(S\)|SES|MES/i.test(t.classOrTypeRating ?? "");
      const k = (t.engineCount > 1 ? (sea ? "MES" : "MEL") : sea ? "SES" : "SEL") as "SEL" | "MEL" | "SES" | "MES";
      const x = cls.get(k) ?? { total: 0, pic: 0, sic: 0 };
      x.total += f.totalMin;
      x.pic += f.picMin;
      x.sic += f.copilotMin;
      cls.set(k, x);
    }
  }
  const order = ["SEL", "MEL", "SES", "MES"] as const;
  return { rows, classes: order.filter((k) => cls.has(k)).map((k) => ({ cls: k, ...cls.get(k)! })), unknown };
}

/** Hours with one decimal, as written on the form ("165.3"). */
export const hours8710 = (min: number) => (min ? (Math.round((min / 60) * 10) / 10).toFixed(1) : "");
