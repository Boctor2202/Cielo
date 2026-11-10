import { distanceNm } from "./geo";
import { minutesBetween } from "./time";
import type { Airport, Flight } from "./types";

export type AuditSeverity = "error" | "warning" | "info";

export interface AuditIssue {
  flightId: string;
  /** i18n key, e.g. "audit.timesOrder" */
  code: AuditCode;
  severity: AuditSeverity;
  params?: Record<string, string | number>;
}

export type AuditCode =
  | "missingTimes"
  | "timesOrder"
  | "overlap"
  | "duplicate"
  | "continuity"
  | "nightExceedsTotal"
  | "ifrExceedsTotal"
  | "functionMismatch"
  | "pilotTimeMismatch"
  | "noLandings"
  | "landingsWithoutPF"
  | "futureDate"
  | "longBlock"
  | "implausibleSpeed"
  | "unknownAirport"
  | "missingAircraft"
  | "missingPicName";

export interface AuditOptions {
  today: string;
  airports: (icao: string) => Airport | undefined;
}

/** Runs every consistency rule over the logbook. Flights may be in any order. */
export function auditLogbook(all: Flight[], opts: AuditOptions): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const flights = all
    .filter((f) => !f.deletedAt)
    .sort((a, b) => (a.outUtc ?? a.date).localeCompare(b.outUtc ?? b.date));
  const push = (f: Flight, code: AuditCode, severity: AuditSeverity, params?: AuditIssue["params"]) =>
    issues.push({ flightId: f.id, code, severity, params });

  const seen = new Map<string, Flight>();
  let prevFlight: Flight | undefined;

  for (const f of flights) {
    if (f.date > opts.today) push(f, "futureDate", "warning");

    if (f.isFstd) {
      if (!f.fstdMin) push(f, "missingTimes", "error");
      continue;
    }

    if (!f.outUtc && !f.offUtc) push(f, "missingTimes", "error");
    if (!f.registration && !f.aircraftId) push(f, "missingAircraft", "warning");

    const seq = [f.outUtc, f.offUtc, f.onUtc, f.inUtc].filter(Boolean) as string[];
    for (let i = 1; i < seq.length; i++) {
      if (Date.parse(seq[i]!) < Date.parse(seq[i - 1]!)) {
        push(f, "timesOrder", "error");
        break;
      }
    }

    if (f.nightMin > f.totalMin) push(f, "nightExceedsTotal", "error");
    if (f.ifrMin > f.totalMin) push(f, "ifrExceedsTotal", "error");

    const fn = f.picMin + f.picusMin + f.copilotMin + f.dualMin + f.instructorMin + f.examinerMin;
    if (f.totalMin > 0 && fn === 0) push(f, "functionMismatch", "warning");
    if (fn > f.totalMin * 1) push(f, "functionMismatch", "error");

    const op = f.singlePilotSeMin + f.singlePilotMeMin + f.multiPilotMin;
    if (op !== f.totalMin) push(f, "pilotTimeMismatch", "warning", { sum: op, total: f.totalMin });

    const ldgs = f.landingsDay + f.landingsNight;
    if (f.pilotFlying && ldgs === 0) push(f, "noLandings", "warning");
    if (!f.pilotFlying && ldgs > 0) push(f, "landingsWithoutPF", "info");

    if (f.totalMin > 20 * 60) push(f, "longBlock", "warning", { minutes: f.totalMin });

    if (f.function !== "PIC" && !f.picName) push(f, "missingPicName", "info");

    const dep = opts.airports(f.depIcao);
    const arr = opts.airports(f.arrIcao);
    if (!dep) push(f, "unknownAirport", "info", { icao: f.depIcao });
    if (!arr && f.arrIcao !== f.depIcao) push(f, "unknownAirport", "info", { icao: f.arrIcao });
    if (dep && arr && f.airMin > 0) {
      const kt = distanceNm(dep, arr) / (f.airMin / 60);
      if (kt > 650) push(f, "implausibleSpeed", "warning", { kt: Math.round(kt) });
    }

    const key = `${f.date}|${f.depIcao}|${f.arrIcao}|${f.outUtc ?? ""}|${f.registration ?? ""}`;
    const dup = seen.get(key);
    if (dup) push(f, "duplicate", "error", { other: dup.id });
    else seen.set(key, f);

    if (prevFlight && !prevFlight.isFstd) {
      const prevEnd = prevFlight.inUtc ?? prevFlight.onUtc;
      const thisStart = f.outUtc ?? f.offUtc;
      if (prevEnd && thisStart && minutesBetween(thisStart, prevEnd) > 0) {
        push(f, "overlap", "error", { other: prevFlight.id });
      }
      const gapH = prevEnd && thisStart ? minutesBetween(prevEnd, thisStart) / 60 : Infinity;
      if (prevFlight.arrIcao !== f.depIcao && gapH < 36) {
        push(f, "continuity", "info", { prev: prevFlight.arrIcao, dep: f.depIcao });
      }
    }
    prevFlight = f;
  }
  return issues;
}
