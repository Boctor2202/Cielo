import { computeNight } from "./night";
import { combineUtc, minutesBetween } from "./time";
import type { Aircraft, AircraftType, Airport, Flight, IfrDefault, OperationMode, PilotFunction } from "./types";

/** What the pilot types in the form. Clocks are UTC "HH:MM". */
export interface FlightFormInput {
  date: string;
  flightNumber?: string;
  operator?: string;
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
  /** With autoLandings: how many takeoffs and landings (0 or 1), instead of one each for the pilot flying. */
  takeoffs?: number;
  landings?: number;
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
  simInstrumentMin?: number;
  holdings?: number;
  groundTrainingMin?: number;
  soloMin?: number;
  safetyPilotName?: string;
  purpose?: string;
  via?: string[];
  /** augmented crew: share of the block time logged (1/2, 1/3, 2/3, 1/4); undefined = all of it */
  loggedShare?: number;
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
  const blockMin = input.isFstd ? 0 : Math.max(0, minutesBetween(blockStart, blockEnd));
  // augmented crew: the pilot logs only their share of the block (1/2, 1/3, 2/3, 1/4), every time scaled alike
  const share = input.loggedShare && input.loggedShare > 0 && input.loggedShare < 1 ? input.loggedShare : 1;
  const totalMin = Math.round(blockMin * share);
  const airMin = Math.round((offUtc && onUtc ? Math.max(0, minutesBetween(offUtc, onUtc)) : blockMin) * share);

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
        nightMin = Math.min(Math.round(r.nightMin * share), totalMin);
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
    const to = input.takeoffs ?? (input.pilotFlying ? 1 : 0);
    const ldg = input.landings ?? (input.pilotFlying ? 1 : 0);
    if (takeoffAtNight) takeoffsNight = to;
    else takeoffsDay = to;
    if (landingAtNight) landingsNight = ldg;
    else landingsDay = ldg;
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
  const entries: [string, unknown][] = keys.map((k) => [k, f[k] ?? null]);
  // fields added later count only when filled, so the signatures made before them stay valid
  if (f.loggedShare && f.loggedShare !== 1) entries.push(["loggedShare", f.loggedShare]);
  for (const k of EXTRA_FLIGHT_FIELDS) {
    const v = f[k];
    if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) entries.push([k, v]);
  }
  return JSON.stringify(entries);
}

/** Entries some authorities require beyond the EASA columns. */
export const EXTRA_FLIGHT_FIELDS = ["simInstrumentMin", "holdings", "groundTrainingMin", "soloMin", "safetyPilotName", "purpose", "via"] as const;
export type ExtraFlightField = (typeof EXTRA_FLIGHT_FIELDS)[number];

/** The extra entries of a flight from the form, cleaned: durations within the flight, names trimmed. */
export function extraFlightFields(input: Partial<FlightFormInput>, totalMin: number): Pick<Flight, ExtraFlightField> {
  const dur = (v: number | undefined, cap?: number) => (v && v > 0 ? Math.round(cap !== undefined ? Math.min(v, cap) : v) : undefined);
  const via = (input.via ?? []).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z0-9]{3,4}$/.test(x));
  return {
    simInstrumentMin: dur(input.simInstrumentMin, totalMin),
    holdings: input.holdings && input.holdings > 0 ? Math.round(input.holdings) : undefined,
    groundTrainingMin: dur(input.groundTrainingMin),
    soloMin: dur(input.soloMin, totalMin),
    safetyPilotName: input.safetyPilotName?.trim() || undefined,
    purpose: input.purpose?.trim() || undefined,
    via: via.length ? via : undefined,
  };
}

/**
 * Which extra entries an authority's logbook asks for, so the form shows them first (all stay available).
 * framework: the rule family; regulator: the chosen authority id.
 */
export function extraFieldsFor(framework: string | undefined, regulator?: string | null): ExtraFlightField[] {
  if (framework === "FAA") return ["simInstrumentMin", "holdings", "groundTrainingMin", "soloMin", "safetyPilotName"];
  if (regulator === "NZCAA") return ["simInstrumentMin", "safetyPilotName", "purpose", "via", "groundTrainingMin"];
  if (regulator === "TCCA") return ["soloMin", "simInstrumentMin", "via"];
  if (framework === "CASA") return ["simInstrumentMin", "safetyPilotName"];
  return [];
}

/** The shares of the block an augmented-crew pilot may log. */
export const LOGGED_SHARES = [1, 1 / 2, 1 / 3, 2 / 3, 1 / 4] as const;
export const shareLabel = (x: number) => (x === 1 ? "1/1" : x === 0.5 ? "1/2" : Math.abs(x - 1 / 3) < 1e-6 ? "1/3" : Math.abs(x - 2 / 3) < 1e-6 ? "2/3" : x === 0.25 ? "1/4" : x.toFixed(2));
