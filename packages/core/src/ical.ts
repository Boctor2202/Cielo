import type { RosterEvent, RosterEventKind } from "./types";

export interface ParsedIcalEvent {
  uid?: string;
  summary: string;
  description?: string;
  location?: string;
  startUtc: string;
  endUtc: string;
  /** a date-only event (DTSTART;VALUE=DATE): a whole day, or several, in the calendar */
  allDay?: boolean;
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
            ...(/^\d{8}$/.test(cur.DTSTART.value) ? { allDay: true } : {}),
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
  const zone = WINDOWS_ZONES[tzid] ?? tzid;
  return new Date(utc - tzOffsetMs(zone, utc)).toISOString();
}

/** Outlook and Exchange write Windows zone names ("Romance Standard Time"): the usual ones, as IANA zones. */
const WINDOWS_ZONES: Record<string, string> = {
  "UTC": "UTC", "Coordinated Universal Time": "UTC", "GMT Standard Time": "Europe/London", "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin", "Romance Standard Time": "Europe/Paris", "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw", "E. Europe Standard Time": "Europe/Chisinau", "GTB Standard Time": "Europe/Bucharest",
  "FLE Standard Time": "Europe/Kiev", "Russian Standard Time": "Europe/Moscow", "Turkey Standard Time": "Europe/Istanbul",
  "Arabian Standard Time": "Asia/Dubai", "Arab Standard Time": "Asia/Riyadh", "Israel Standard Time": "Asia/Jerusalem", "Egypt Standard Time": "Africa/Cairo",
  "Morocco Standard Time": "Africa/Casablanca", "South Africa Standard Time": "Africa/Johannesburg", "India Standard Time": "Asia/Kolkata",
  "Singapore Standard Time": "Asia/Singapore", "China Standard Time": "Asia/Shanghai", "Tokyo Standard Time": "Asia/Tokyo",
  "AUS Eastern Standard Time": "Australia/Sydney", "E. Australia Standard Time": "Australia/Brisbane", "W. Australia Standard Time": "Australia/Perth",
  "New Zealand Standard Time": "Pacific/Auckland", "Eastern Standard Time": "America/New_York", "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver", "US Mountain Standard Time": "America/Phoenix", "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage", "Hawaiian Standard Time": "Pacific/Honolulu", "Atlantic Standard Time": "America/Halifax",
  "Canada Central Standard Time": "America/Regina", "SA Pacific Standard Time": "America/Bogota", "E. South America Standard Time": "America/Sao_Paulo",
  "Argentina Standard Time": "America/Buenos_Aires", "Azores Standard Time": "Atlantic/Azores", "Cape Verde Standard Time": "Atlantic/Cape_Verde",
};

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

// "CDG-JFK", "CDG > JFK", and with the times between the codes as many crew apps print them ("CDG 1030 JFK 1855")
const ICAO_PAIR = /\b([A-Z]{4})\s*(?:\d{4}Z?|\d{1,2}:\d{2}Z?)?\s*[-–>/ ]+\s*([A-Z]{4})\b/;
const IATA_PAIR = /\b([A-Z]{3})\s*(?:\d{4}Z?|\d{1,2}:\d{2}Z?)?\s*[-–>/ ]+\s*([A-Z]{3})\b/;
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
  // the title decides first: a flight whose notes mention the hotel at the outstation is still a flight
  const title = e.summary.toUpperCase();
  const text = `${e.summary} ${e.location ?? ""} ${e.description ?? ""}`.toUpperCase();
  const kindOf = (t: string): RosterEventKind => {
    if (/\b(DH|DHD|DEADHEAD|POSITIONING|MEP|PAX)\b/.test(t)) return "DEADHEAD";
    if (/\b(SBY|STBY|STANDBY|RESERVE|RSV|HSBY|ASBY)\b/.test(t)) return "STANDBY";
    if (/\b(SIM|FFS|FSTD|LOE|OPC|LPC)\b/.test(t)) return "SIM";
    if (/\b(OFF|DAY OFF|REPOS|JOUR OFF|RDO)\b/.test(t)) return "OFF";
    if (/\b(LEAVE|CONGE|CONGÉ|VACATION|HOLIDAY)\b/.test(t)) return "LEAVE";
    if (/\b(HOTEL|LAYOVER|REST|NIGHTSTOP)\b/.test(t)) return "REST";
    if (/\b(GROUND|TRAINING|COURSE|OFFICE|MEDICAL|CRM|SEP|E-LEARNING)\b/.test(t)) return "GROUND";
    return "OTHER";
  };

  let depIcao: string | undefined;
  let arrIcao: string | undefined;
  const pair = (t: string) => {
    const icao = t.match(ICAO_PAIR);
    if (icao) return [icao[1], icao[2]] as const;
    const iata = t.match(IATA_PAIR);
    if (iata) {
      const a = iataToIcao(iata[1]!);
      const b = iataToIcao(iata[2]!);
      if (a && b) return [a, b] as const;
    }
    return null;
  };
  // a whole-day event is a rotation or a day code ("MCR351R3U - 1ON"): its notes list the legs of the
  // rotation, a positioning leg among them, and those legs come as events of their own. Only its title
  // tells what it is; from the notes, only a day that is not flying (off, leave, standby…) is read.
  const wholeDay = !!e.allDay || Date.parse(e.endUtc) - Date.parse(e.startUtc) >= 20 * 3600_000;
  // nor does it fly a route: "MCR353N8D - 3ON - IST MXP" names the layover stations of a 3-day rotation.
  // A route read in the notes that comes back where it started ("CDG … CDG") is a duty at base, not a flight.
  const fromNotes = wholeDay ? null : pair(text);
  const fromTitle = wholeDay ? null : pair(title);
  const route = fromTitle ?? (fromNotes && fromNotes[0] !== fromNotes[1] ? fromNotes : null);
  if (route) [depIcao, arrIcao] = route;
  let kind = kindOf(title);
  // a title with a route and no other word is a flight; otherwise the notes may tell what the day is
  if (kind === "OTHER" && !fromTitle) {
    const fromText = kindOf(text);
    if (!wholeDay || fromText === "OFF" || fromText === "LEAVE" || fromText === "STANDBY") kind = fromText;
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
