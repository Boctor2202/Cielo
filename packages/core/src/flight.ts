import { computeNight } from "./night";
import { combineUtc, minutesBetween } from "./time";
import type { Aircraft, AircraftType, Airport, Flight, IfrDefault, OperationMode, PilotFunction } from "./types";

/** What the pilot types in the form. Clocks are UTC "HH:MM". */
export interface FlightFormInput {
  date: string;
  flightNumber?: string;
  depIcao: string;
  arrIcao: string;
  out?: string;
  off?: string;
  on?: string;
  in?: string;
  aircraftId?: string | null;
  registration?: string;
  aircraftTypeIcao?: string;
  aircraftModel?: string;
  operation?: OperationMode;
  function: PilotFunction;
  picName?: string;
  ifr: boolean;
  /** Manually entered override, minutes. undefined = automatic. */
  nightOverrideMin?: number;
  ifrOverrideMin?: number;
  actualImcMin?: number;
  xcMin?: number;
  takeoffsDay?: number;
  takeoffsNight?: number;
  landingsDay?: number;
  landingsNight?: number;
  /** When true, day/night landings are derived from the computed landing time. */
  autoLandings?: boolean;
  pilotFlying: boolean;
  approaches?: Flight["approaches"];
  isFstd: boolean;
  fstdType?: string;
  fstdQualification?: string;
  fstdMin?: number;
  crew?: Flight["crew"];
  remarks?: string;
}

export interface DeriveContext {
  airports: (icao: string) => Airport | undefined;
  aircraftType?: AircraftType;
  aircraft?: Aircraft;
}

export interface DerivedTimes {
  outUtc: string | null;
  offUtc: string | null;
  onUtc: string | null;
  inUtc: string | null;
  totalMin: number;
  airMin: number;
  nightMin: number;
  nightCalc: "auto" | "manual";
  ifrMin: number;
  singlePilotSeMin: number;
  singlePilotMeMin: number;
  multiPilotMin: number;
  picMin: number;
  picusMin: number;
  copilotMin: number;
  dualMin: number;
  instructorMin: number;
  examinerMin: number;
  takeoffsDay: number;
  takeoffsNight: number;
  landingsDay: number;
  landingsNight: number;
  warnings: string[];
}

/** Resolves clock times into UTC instants (handling midnight crossings) and derives every logbook column. */
export function deriveFlightTimes(input: FlightFormInput, ctx: DeriveContext): DerivedTimes {
  const warnings: string[] = [];
  const outUtc = combineUtc(input.date, input.out);
  const offUtc = combineUtc(input.date, input.off, outUtc);
  const onUtc = combineUtc(input.date, input.on, offUtc ?? outUtc);
  const inUtc = combineUtc(input.date, input.in, onUtc ?? offUtc ?? outUtc);

  const blockStart = outUtc ?? offUtc;
  const blockEnd = inUtc ?? onUtc;
  const totalMin = input.isFstd ? 0 : Math.max(0, minutesBetween(blockStart, blockEnd));
  const airMin = offUtc && onUtc ? Math.max(0, minutesBetween(offUtc, onUtc)) : totalMin;

  // Night
  let nightMin = 0;
  let nightCalc: "auto" | "manual" = "auto";
  let landingAtNight = false;
  let takeoffAtNight = false;
  if (input.nightOverrideMin !== undefined && input.nightOverrideMin !== null) {
    nightMin = input.nightOverrideMin;
    nightCalc = "manual";
  } else if (!input.isFstd) {
    const dep = ctx.airports(input.depIcao);
    const arr = ctx.airports(input.arrIcao);
    if (dep && arr) {
      const r = computeNight({ dep, arr, outUtc, offUtc, onUtc, inUtc });
      if (r) {
        nightMin = Math.min(r.nightMin, totalMin);
        landingAtNight = r.landingAtNight;
        takeoffAtNight = r.takeoffAtNight;
      }
    } else if (totalMin > 0) {
      warnings.push("night.unknownAirport");
    }
  }

  const ifrMin = input.isFstd
    ? 0
    : input.ifrOverrideMin !== undefined && input.ifrOverrideMin !== null
      ? Math.min(input.ifrOverrideMin, totalMin)
      : input.ifr
        ? totalMin
        : 0;

  // Single / multi pilot
  const type = ctx.aircraftType;
  const operation: OperationMode =
    input.operation ?? ctx.aircraft?.defaultOperation ?? (type?.multiPilot ? "multi_pilot" : "single_pilot");
  let singlePilotSeMin = 0;
  let singlePilotMeMin = 0;
  let multiPilotMin = 0;
  if (!input.isFstd) {
    if (operation === "multi_pilot") multiPilotMin = totalMin;
    else if ((type?.engineCount ?? 1) > 1) singlePilotMeMin = totalMin;
    else singlePilotSeMin = totalMin;
  }

  // Function
  const f = input.function;
  const picMin = !input.isFstd && f === "PIC" ? totalMin : 0;
  const picusMin = !input.isFstd && f === "PICUS" ? totalMin : 0;
  const copilotMin = !input.isFstd && f === "SIC" ? totalMin : 0;
  const dualMin = !input.isFstd && f === "DUAL" ? totalMin : 0;
  const instructorMin = !input.isFstd && f === "FI" ? totalMin : 0;
  const examinerMin = !input.isFstd && f === "FE" ? totalMin : 0;

  // Takeoffs / landings: by default the pilot flying gets one of each.
  let takeoffsDay = input.takeoffsDay ?? 0;
  let takeoffsNight = input.takeoffsNight ?? 0;
  let landingsDay = input.landingsDay ?? 0;
  let landingsNight = input.landingsNight ?? 0;
  if (input.autoLandings && !input.isFstd) {
    takeoffsDay = takeoffsNight = landingsDay = landingsNight = 0;
    if (input.pilotFlying) {
      if (takeoffAtNight) takeoffsNight = 1;
      else takeoffsDay = 1;
      if (landingAtNight) landingsNight = 1;
      else landingsDay = 1;
    }
  }

  return {
    outUtc,
    offUtc,
    onUtc,
    inUtc,
    totalMin,
    airMin,
    nightMin,
    nightCalc,
    ifrMin,
    singlePilotSeMin,
    singlePilotMeMin,
    multiPilotMin,
    picMin,
    picusMin,
    copilotMin,
    dualMin,
    instructorMin,
    examinerMin,
    takeoffsDay,
    takeoffsNight,
    landingsDay,
    landingsNight,
    warnings,
  };
}

export function defaultIfrFor(rule: IfrDefault, type?: AircraftType): boolean {
  if (rule === "always") return true;
  if (rule === "never") return false;
  return !!type?.multiPilot;
}

/** Fields that define the content of a flight entry (used for signature hashing). */
export function canonicalFlightContent(f: Flight): string {
  const keys: (keyof Flight)[] = [
    "date", "depIcao", "arrIcao", "outUtc", "offUtc", "onUtc", "inUtc", "registration", "aircraftTypeIcao",
    "totalMin", "singlePilotSeMin", "singlePilotMeMin", "multiPilotMin", "function", "picName", "picMin",
    "picusMin", "copilotMin", "dualMin", "instructorMin", "examinerMin", "nightMin", "ifrMin", "takeoffsDay",
    "takeoffsNight", "landingsDay", "landingsNight", "isFstd", "fstdType", "fstdMin", "remarks",
  ];
  return JSON.stringify(keys.map((k) => [k, f[k] ?? null]));
}
