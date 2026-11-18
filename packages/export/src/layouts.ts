import { formatClock, formatDateShort, type Flight, type Totals } from "@cielo/core";

export type LayoutId = "EASA" | "FAA" | "CASA";

export interface Column {
  group?: string;
  sub?: string;
  /** relative width */
  w: number;
  align: "left" | "center" | "right";
  value: (f: Flight, fmt: (min: number) => string) => string;
  sum?: (t: Totals) => number;
  sumKind?: "time" | "count";
}

export interface Layout {
  id: LayoutId;
  title: string;
  reference: string;
  certify: string;
  decimal: boolean;
  rowsPerPage: number;
  columns: Column[];
}

const t = (min: number, fmt: (m: number) => string) => (min ? fmt(min) : "");
const n = (v: number) => (v ? String(v) : "");
const fl = (f: Flight) => !f.isFstd;
const remarks = (f: Flight) => {
  const parts: string[] = [];
  if (f.function === "PICUS") parts.push("PICUS");
  if (f.function === "FE") parts.push("FE");
  if (f.flightNumber) parts.push(f.flightNumber);
  if (f.approaches?.length) parts.push(f.approaches.map((a) => `${a.count}x${a.type}${a.airport ? ` ${a.airport}` : ""}`).join(" "));
  if (f.via?.length) parts.push(`Via ${f.via.join(" ")}`);
  if (f.safetyPilotName) parts.push(`Safety pilot/instr. ${f.safetyPilotName}`);
  if (f.purpose) parts.push(f.purpose);
  if (f.signatureId) parts.push("Signed");
  if (f.remarks) parts.push(f.remarks);
  return parts.join(" / ");
};

/** EASA AMC1 FCL.050 logbook columns (1)–(13). PICUS is logged as PIC with a "PICUS" remark. */
const EASA: Layout = {
  id: "EASA",
  title: "PILOT LOGBOOK — EASA Part-FCL (AMC1 FCL.050)",
  reference: "Format per EASA Part-FCL AMC1 FCL.050. Times in hours:minutes, UTC.",
  certify: "I certify that the entries in this log are true.",
  decimal: false,
  rowsPerPage: 20,
  columns: [
    { sub: "1 DATE (dd/mm/yy)", w: 5.2, align: "center", value: (f) => (fl(f) ? formatDateShort(f.date) : "") },
    { group: "2 DEPARTURE", sub: "PLACE", w: 4.2, align: "center", value: (f) => (fl(f) ? f.depIcao : "") },
    { group: "2 DEPARTURE", sub: "TIME", w: 3.8, align: "center", value: (f) => (fl(f) ? formatClock(f.outUtc ?? f.offUtc) : "") },
    { group: "3 ARRIVAL", sub: "PLACE", w: 4.2, align: "center", value: (f) => (fl(f) ? f.arrIcao : "") },
    { group: "3 ARRIVAL", sub: "TIME", w: 3.8, align: "center", value: (f) => (fl(f) ? formatClock(f.inUtc ?? f.onUtc) : "") },
    { group: "4 AIRCRAFT", sub: "MAKE, MODEL, VARIANT", w: 7.6, align: "left", value: (f) => (fl(f) ? (f.aircraftModel || f.aircraftTypeIcao || "") : "") },
    { group: "4 AIRCRAFT", sub: "REGISTRATION", w: 5.2, align: "center", value: (f) => (fl(f) ? (f.registration ?? "") : "") },
    { group: "5 SINGLE PILOT TIME", sub: "SE", w: 3.6, align: "right", value: (f, fmt) => t(f.singlePilotSeMin, fmt), sum: (x) => x.singlePilotSeMin },
    { group: "5 SINGLE PILOT TIME", sub: "ME", w: 3.6, align: "right", value: (f, fmt) => t(f.singlePilotMeMin, fmt), sum: (x) => x.singlePilotMeMin },
    { sub: "6 MULTI-PILOT TIME", w: 4.2, align: "right", value: (f, fmt) => t(f.multiPilotMin, fmt), sum: (x) => x.multiPilotMin },
    { sub: "7 TOTAL TIME OF FLIGHT", w: 4.4, align: "right", value: (f, fmt) => t(f.totalMin, fmt), sum: (x) => x.totalMin },
    { sub: "8 NAME PIC", w: 7, align: "left", value: (f) => (fl(f) ? (f.function === "PIC" ? "SELF" : (f.picName ?? "")) : "") },
    { group: "9 LANDINGS", sub: "DAY", w: 2.6, align: "right", value: (f) => n(f.landingsDay), sum: (x) => x.landingsDay, sumKind: "count" },
    { group: "9 LANDINGS", sub: "NIGHT", w: 2.6, align: "right", value: (f) => n(f.landingsNight), sum: (x) => x.landingsNight, sumKind: "count" },
    { group: "10 OPERATIONAL CONDITION TIME", sub: "NIGHT", w: 3.8, align: "right", value: (f, fmt) => t(f.nightMin, fmt), sum: (x) => x.nightMin },
    { group: "10 OPERATIONAL CONDITION TIME", sub: "IFR", w: 3.8, align: "right", value: (f, fmt) => t(f.ifrMin, fmt), sum: (x) => x.ifrMin },
    { group: "11 PILOT FUNCTION TIME", sub: "PILOT-IN-COMMAND", w: 4.2, align: "right", value: (f, fmt) => t(f.picMin + f.picusMin, fmt), sum: (x) => x.picMin + x.picusMin },
    { group: "11 PILOT FUNCTION TIME", sub: "CO-PILOT", w: 3.8, align: "right", value: (f, fmt) => t(f.copilotMin, fmt), sum: (x) => x.copilotMin },
    { group: "11 PILOT FUNCTION TIME", sub: "DUAL", w: 3.8, align: "right", value: (f, fmt) => t(f.dualMin, fmt), sum: (x) => x.dualMin },
    { group: "11 PILOT FUNCTION TIME", sub: "INSTRUCTOR", w: 3.8, align: "right", value: (f, fmt) => t(f.instructorMin + f.examinerMin, fmt), sum: (x) => x.instructorMin + x.examinerMin },
    { group: "12 FSTD SESSION", sub: "DATE (dd/mm/yy)", w: 4.6, align: "center", value: (f) => (f.isFstd ? formatDateShort(f.date) : "") },
    { group: "12 FSTD SESSION", sub: "TYPE", w: 4.4, align: "left", value: (f) => (f.isFstd ? (f.fstdType ?? "") : "") },
    { group: "12 FSTD SESSION", sub: "TOTAL TIME OF SESSION", w: 4, align: "right", value: (f, fmt) => (f.isFstd ? t(f.fstdMin, fmt) : ""), sum: (x) => x.fstdMin },
    { sub: "13 REMARKS AND ENDORSEMENTS", w: 10, align: "left", value: (f) => remarks(f) },
  ],
};

/** FAA 14 CFR 61.51 — records the required elements; decimal hours. */
const FAA: Layout = {
  id: "FAA",
  title: "PILOT LOGBOOK — FAA 14 CFR 61.51",
  reference: "Records the elements required by 14 CFR 61.51. Times in decimal hours.",
  certify: "I certify that the statements made by me on this form are true.",
  decimal: true,
  rowsPerPage: 20,
  columns: [
    { sub: "DATE", w: 5, align: "center", value: (f) => formatDateShort(f.date, "en") },
    { sub: "AIRCRAFT TYPE", w: 5, align: "left", value: (f) => (f.isFstd ? (f.fstdType ?? "FSTD") : (f.aircraftTypeIcao ?? "")) },
    { sub: "AIRCRAFT IDENT", w: 5, align: "center", value: (f) => (fl(f) ? (f.registration ?? "") : "") },
    { group: "ROUTE OF FLIGHT", sub: "FROM", w: 4, align: "center", value: (f) => (fl(f) ? f.depIcao : "") },
    { group: "ROUTE OF FLIGHT", sub: "TO", w: 4, align: "center", value: (f) => (fl(f) ? f.arrIcao : "") },
    { sub: "NR INST. APP.", w: 3, align: "right", value: (f) => n((f.approaches ?? []).reduce((s, a) => s + a.count, 0)), sum: (x) => x.approaches, sumKind: "count" },
    { group: "LANDINGS", sub: "DAY", w: 2.6, align: "right", value: (f) => n(f.landingsDay), sum: (x) => x.landingsDay, sumKind: "count" },
    { group: "LANDINGS", sub: "NIGHT", w: 2.6, align: "right", value: (f) => n(f.landingsNight), sum: (x) => x.landingsNight, sumKind: "count" },
    { group: "CATEGORY / CLASS", sub: "SEL", w: 3.4, align: "right", value: (f, fmt) => t(f.singlePilotSeMin, fmt), sum: (x) => x.singlePilotSeMin },
    { group: "CATEGORY / CLASS", sub: "MEL", w: 3.4, align: "right", value: (f, fmt) => t(f.singlePilotMeMin + f.multiPilotMin, fmt), sum: (x) => x.singlePilotMeMin + x.multiPilotMin },
    { group: "CONDITIONS", sub: "NIGHT", w: 3.4, align: "right", value: (f, fmt) => t(f.nightMin, fmt), sum: (x) => x.nightMin },
    { group: "CONDITIONS", sub: "ACTUAL INST.", w: 3.4, align: "right", value: (f, fmt) => t(f.actualImcMin, fmt), sum: (x) => x.actualImcMin },
    { group: "CONDITIONS", sub: "SIM. INST.", w: 3.2, align: "right", value: (f, fmt) => t(f.simInstrumentMin ?? 0, fmt), sum: (x) => x.simInstrumentMin },
    { group: "CONDITIONS", sub: "CROSS COUNTRY", w: 3.4, align: "right", value: (f, fmt) => t(f.xcMin, fmt), sum: (x) => x.xcMin },
    { sub: "HOLDS", w: 2.4, align: "right", value: (f) => n(f.holdings ?? 0), sum: (x) => x.holdings, sumKind: "count" },
    { sub: "FSTD / SIM", w: 3.4, align: "right", value: (f, fmt) => (f.isFstd ? t(f.fstdMin, fmt) : ""), sum: (x) => x.fstdMin },
    { sub: "GROUND TRNG", w: 3.2, align: "right", value: (f, fmt) => t(f.groundTrainingMin ?? 0, fmt), sum: (x) => x.groundTrainingMin },
    { group: "TYPE OF PILOTING TIME", sub: "DUAL RECEIVED", w: 3.4, align: "right", value: (f, fmt) => t(f.dualMin, fmt), sum: (x) => x.dualMin },
    { group: "TYPE OF PILOTING TIME", sub: "SOLO", w: 3, align: "right", value: (f, fmt) => t(f.soloMin ?? 0, fmt), sum: (x) => x.soloMin },
    { group: "TYPE OF PILOTING TIME", sub: "PIC", w: 3.4, align: "right", value: (f, fmt) => t(f.picMin + f.picusMin, fmt), sum: (x) => x.picMin + x.picusMin },
    { group: "TYPE OF PILOTING TIME", sub: "SIC", w: 3.4, align: "right", value: (f, fmt) => t(f.copilotMin, fmt), sum: (x) => x.copilotMin },
    { group: "TYPE OF PILOTING TIME", sub: "AS FLIGHT INSTR.", w: 3.4, align: "right", value: (f, fmt) => t(f.instructorMin + f.examinerMin, fmt), sum: (x) => x.instructorMin + x.examinerMin },
    { sub: "TOTAL DURATION OF FLIGHT", w: 4, align: "right", value: (f, fmt) => t(f.totalMin, fmt), sum: (x) => x.totalMin },
    { sub: "REMARKS AND ENDORSEMENTS", w: 10, align: "left", value: (f) => remarks(f) },
  ],
};

/** CASA CASR 61.345 — records the required elements; decimal hours. */
const CASA: Layout = {
  id: "CASA",
  title: "PILOT LOGBOOK — CASA CASR Part 61 (61.345)",
  reference: "Records the elements required by CASR 61.345. Times in decimal hours.",
  certify: "I certify that the entries in this logbook are true and correct.",
  decimal: true,
  rowsPerPage: 20,
  columns: [
    { sub: "DATE", w: 5, align: "center", value: (f) => formatDateShort(f.date) },
    { group: "AIRCRAFT", sub: "TYPE", w: 5, align: "left", value: (f) => (f.isFstd ? (f.fstdType ?? "FSTD") : (f.aircraftTypeIcao ?? "")) },
    { group: "AIRCRAFT", sub: "REGISTRATION", w: 5, align: "center", value: (f) => (fl(f) ? (f.registration ?? "") : "") },
    { sub: "PILOT IN COMMAND", w: 7, align: "left", value: (f) => (fl(f) ? (f.function === "PIC" ? "SELF" : (f.picName ?? "")) : "") },
    { sub: "DETAILS OF FLIGHT", w: 8, align: "left", value: (f) => (fl(f) ? `${f.depIcao} - ${f.arrIcao}` : "FSTD") },
    { group: "SINGLE-ENGINE", sub: "DAY", w: 3.2, align: "right", value: (f, fmt) => t(Math.max(0, f.singlePilotSeMin - Math.min(f.singlePilotSeMin, f.nightMin)), fmt) },
    { group: "SINGLE-ENGINE", sub: "NIGHT", w: 3.2, align: "right", value: (f, fmt) => t(Math.min(f.singlePilotSeMin, f.nightMin), fmt) },
    { group: "MULTI-ENGINE", sub: "DAY", w: 3.2, align: "right", value: (f, fmt) => { const me = f.singlePilotMeMin + f.multiPilotMin; return t(Math.max(0, me - Math.min(me, f.nightMin)), fmt); } },
    { group: "MULTI-ENGINE", sub: "NIGHT", w: 3.2, align: "right", value: (f, fmt) => t(Math.min(f.singlePilotMeMin + f.multiPilotMin, f.nightMin), fmt) },
    { group: "PILOT FUNCTION", sub: "COMMAND", w: 3.2, align: "right", value: (f, fmt) => t(f.picMin, fmt), sum: (x) => x.picMin },
    { group: "PILOT FUNCTION", sub: "ICUS", w: 3.2, align: "right", value: (f, fmt) => t(f.picusMin, fmt), sum: (x) => x.picusMin },
    { group: "PILOT FUNCTION", sub: "CO-PILOT", w: 3.2, align: "right", value: (f, fmt) => t(f.copilotMin, fmt), sum: (x) => x.copilotMin },
    { group: "PILOT FUNCTION", sub: "DUAL", w: 3.2, align: "right", value: (f, fmt) => t(f.dualMin, fmt), sum: (x) => x.dualMin },
    { group: "PILOT FUNCTION", sub: "INSTRUCTOR", w: 3.2, align: "right", value: (f, fmt) => t(f.instructorMin + f.examinerMin, fmt), sum: (x) => x.instructorMin + x.examinerMin },
    { group: "INSTRUMENT", sub: "FLIGHT", w: 3.2, align: "right", value: (f, fmt) => t(f.ifrMin, fmt), sum: (x) => x.ifrMin },
    { group: "INSTRUMENT", sub: "SIM / FSTD", w: 3.2, align: "right", value: (f, fmt) => (f.isFstd ? t(f.fstdMin, fmt) : ""), sum: (x) => x.fstdMin },
    { sub: "TOTAL", w: 3.6, align: "right", value: (f, fmt) => t(f.totalMin, fmt), sum: (x) => x.totalMin },
    { sub: "REMARKS", w: 10, align: "left", value: (f) => remarks(f) },
  ],
};

export const LAYOUTS: Record<LayoutId, Layout> = { EASA, FAA, CASA };
