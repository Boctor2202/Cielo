import type { RosterEvent, RosterEventKind } from "./types";

export interface ParsedIcalEvent {
  uid?: string;
  summary: string;
  description?: string;
  location?: string;
  startUtc: string;
  endUtc: string;
}

/** Unfolds and parses VEVENTs. Handles UTC (Z), floating and TZID times (TZID treated via Intl). */
export function parseIcal(text: string): ParsedIcalEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const events: ParsedIcalEvent[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.DTSTART) {
        const start = icalDate(cur.DTSTART.value, cur.DTSTART.params.TZID);
        const end = cur.DTEND ? icalDate(cur.DTEND.value, cur.DTEND.params.TZID) : start;
        if (start && end) {
          events.push({
            uid: cur.UID?.value,
            summary: unescape(cur.SUMMARY?.value ?? ""),
            description: cur.DESCRIPTION ? unescape(cur.DESCRIPTION.value) : undefined,
            location: cur.LOCATION ? unescape(cur.LOCATION.value) : undefined,
            startUtc: start,
            endUtc: end,
          });
        }
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const [name, ...paramParts] = line.slice(0, idx).split(";");
      const params: Record<string, string> = {};
      for (const p of paramParts) {
        const [k, v] = p.split("=");
        if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, "");
      }
      cur[name!.toUpperCase()] = { value: line.slice(idx + 1), params };
    }
  }
  return events;
}

function unescape(s: string) {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function icalDate(v: string, tzid?: string): string | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  const utc = Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +s);
  if (z || !tzid) return new Date(utc).toISOString();
  return new Date(utc - tzOffsetMs(tzid, utc)).toISOString();
}

/** Offset of `timeZone` from UTC at the given instant, in ms. */
export function tzOffsetMs(timeZone: string, utcMs: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
    return asUtc - utcMs;
  } catch {
    return 0;
  }
}

const ICAO_PAIR = /\b([A-Z]{4})\s*[-–>/ ]+\s*([A-Z]{4})\b/;
const IATA_PAIR = /\b([A-Z]{3})\s*[-–>/ ]+\s*([A-Z]{3})\b/;
const FLIGHT_NO = /\b([A-Z]{2,3}|[A-Z]\d|\d[A-Z])\s?(\d{1,4}[A-Z]?)\b/;

/**
 * Classifies a calendar event into a roster event using common airline roster wording.
 * `iataToIcao` lets the caller resolve 3-letter codes.
 */
export function icalToRosterEvent(
  e: ParsedIcalEvent,
  pilotId: string,
  iataToIcao: (iata: string) => string | undefined,
): Omit<RosterEvent, "id" | "createdAt" | "updatedAt"> {
  const text = `${e.summary} ${e.location ?? ""} ${e.description ?? ""}`.toUpperCase();
  let kind: RosterEventKind = "OTHER";
  if (/\b(DH|DHD|DEADHEAD|POSITIONING|MEP|PAX)\b/.test(text)) kind = "DEADHEAD";
  else if (/\b(SBY|STBY|STANDBY|RESERVE|RSV|HSBY|ASBY)\b/.test(text)) kind = "STANDBY";
  else if (/\b(SIM|FFS|FSTD|LOE|OPC|LPC)\b/.test(text)) kind = "SIM";
  else if (/\b(OFF|DAY OFF|REPOS|JOUR OFF|RDO)\b/.test(text)) kind = "OFF";
  else if (/\b(LEAVE|CONGE|CONGÉ|VACATION|HOLIDAY)\b/.test(text)) kind = "LEAVE";
  else if (/\b(HOTEL|LAYOVER|REST|NIGHTSTOP)\b/.test(text)) kind = "REST";
  else if (/\b(GROUND|TRAINING|COURSE|OFFICE|MEDICAL|CRM|SEP|E-LEARNING)\b/.test(text)) kind = "GROUND";

  let depIcao: string | undefined;
  let arrIcao: string | undefined;
  const icao = text.match(ICAO_PAIR);
  if (icao) {
    depIcao = icao[1];
    arrIcao = icao[2];
  } else {
    const iata = text.match(IATA_PAIR);
    if (iata) {
      depIcao = iataToIcao(iata[1]!) ?? undefined;
      arrIcao = iataToIcao(iata[2]!) ?? undefined;
    }
  }
  if (kind === "OTHER" && depIcao && arrIcao) kind = "FLIGHT";
  const fn = kind === "FLIGHT" || kind === "DEADHEAD" ? e.summary.toUpperCase().match(FLIGHT_NO) : null;

  return {
    pilotId,
    kind,
    title: e.summary,
    startUtc: e.startUtc,
    endUtc: e.endUtc,
    depIcao,
    arrIcao,
    flightNumber: fn ? `${fn[1]}${fn[2]}` : undefined,
    externalUid: e.uid,
  };
}
