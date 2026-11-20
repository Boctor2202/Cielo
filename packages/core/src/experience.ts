import type { Flight, OpeningBalance } from "./types";

/**
 * Flight experience broken down the way recruiters, authorities and the CV read it. One definition per figure,
 * shared by the website, the app, the CV and the job matching, so a number means the same everywhere.
 *
 * Definitions (EASA FCL.050 / AMC1 FCL.050 wording, the logbook's own columns):
 *  - total      : block time of real flights (simulator sessions excluded) + paper totals carried forward.
 *  - PIC        : pilot-in-command time only (`picMin`). PICUS is NOT included.
 *  - PICUS      : pilot-in-command under supervision (`picusMin`). Some formats (EASA logbook PIC column, some
 *                 airline forms) add it to PIC; Geardown shows it apart and never counts it as PIC for a job
 *                 requirement. Carry-forwards have no PICUS field: any PICUS inside a paper PIC total is unknown.
 *  - SIC        : co-pilot time (`copilotMin`).
 *  - dual       : time under instruction (`dualMin`).
 *  - instructor : time as instructor (`instructorMin`); examiner time apart (`examinerMin`).
 *  - simulator  : FSTD sessions (`fstdMin`), never part of total or PIC.
 *  - multi-pilot / single-pilot SE / single-pilot ME: the logbook's operation columns.
 *  - turbine / jet / turboprop: from the aircraft type's engine (unknown types are counted apart, never guessed).
 *  - PIC on jet / PIC on multi-engine turboprop: PIC time on a flight whose type is a jet, or a turboprop flown on
 *    a multi-engine column (single-pilot ME or multi-pilot).
 * All values in minutes; rounding is for display only.
 */
export type EngineKind = "piston" | "turboprop" | "jet" | "turboshaft" | "electric" | "none";

export interface Experience {
  totalMin: number;
  picMin: number;
  picusMin: number;
  sicMin: number;
  dualMin: number;
  instructorMin: number;
  examinerMin: number;
  simMin: number;
  multiPilotMin: number;
  singlePilotSeMin: number;
  singlePilotMeMin: number;
  multiEngineMin: number;
  turbineMin: number;
  jetMin: number;
  turbopropMin: number;
  picJetMin: number;
  picMeTurbopropMin: number;
  /** PIC on jet or on multi-engine turboprop (the "300 h PIC jet / ME turboprop" requirement) */
  picJetOrMeTurbopropMin: number;
  /** PIC on a turbine type (jet, turboprop, turboshaft) */
  picTurbineMin: number;
  /** PIC on a multi-engine column (single-pilot ME or multi-pilot) */
  picMultiEngineMin: number;
  byType: Record<string, { totalMin: number; picMin: number; picusMin: number; sicMin: number }>;
  /** what could not be classified: these keep figures honest instead of guessing */
  unknown: {
    /** flight time on types whose engine is unknown (not in turbine / jet / turboprop) */
    engineMin: number;
    /** carried-forward totals without an aircraft type (not in turbine / jet / on-type) */
    openingNoTypeMin: number;
    /** carried-forward PIC (may include PICUS: paper totals do not say) */
    openingPicMin: number;
  };
}

type FlightLike = Pick<Flight, "totalMin" | "picMin" | "picusMin" | "copilotMin" | "dualMin" | "instructorMin" | "examinerMin" | "multiPilotMin" | "singlePilotSeMin" | "singlePilotMeMin" | "fstdMin" | "isFstd" | "aircraftTypeIcao" | "deletedAt">;
type OpeningLike = Pick<OpeningBalance, "totalMin" | "picMin" | "copilotMin" | "dualMin" | "instructorMin" | "multiPilotMin" | "singlePilotSeMin" | "singlePilotMeMin" | "fstdMin" | "aircraftTypeIcao" | "deletedAt">;

const n = (v: number | undefined | null) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const turbine = (e?: string) => e === "jet" || e === "turboprop" || e === "turboshaft";

export function experience(flights: Partial<FlightLike>[], opening: Partial<OpeningLike>[] = [], engineOf: (icao: string) => string | undefined = () => undefined): Experience {
  const x: Experience = {
    totalMin: 0, picMin: 0, picusMin: 0, sicMin: 0, dualMin: 0, instructorMin: 0, examinerMin: 0, simMin: 0,
    multiPilotMin: 0, singlePilotSeMin: 0, singlePilotMeMin: 0, multiEngineMin: 0, turbineMin: 0, jetMin: 0,
    turbopropMin: 0, picJetMin: 0, picMeTurbopropMin: 0, picJetOrMeTurbopropMin: 0, picTurbineMin: 0, picMultiEngineMin: 0, byType: {},
    unknown: { engineMin: 0, openingNoTypeMin: 0, openingPicMin: 0 },
  };
  const row = (icao: string) => (x.byType[icao] ??= { totalMin: 0, picMin: 0, picusMin: 0, sicMin: 0 });
  const engine = (icao: string | null | undefined, min: number) => {
    const e = icao ? engineOf(icao.toUpperCase()) : undefined;
    if (icao && !e) x.unknown.engineMin += min;
    if (turbine(e)) x.turbineMin += min;
    if (e === "jet") x.jetMin += min;
    if (e === "turboprop") x.turbopropMin += min;
    return e;
  };
  const pic = (e: string | undefined, picMin: number, meMin: number) => {
    let jet = 0, tp = 0;
    if (e === "jet") jet = picMin;
    else if (e === "turboprop") tp = Math.min(picMin, meMin);
    x.picJetMin += jet;
    x.picMeTurbopropMin += tp;
    x.picJetOrMeTurbopropMin += jet + tp;
    if (turbine(e)) x.picTurbineMin += picMin;
    x.picMultiEngineMin += Math.min(picMin, meMin);
  };

  for (const f of flights) {
    if (f.deletedAt) continue;
    if (f.isFstd) {
      x.simMin += n(f.fstdMin) || n(f.totalMin);
      continue;
    }
    const total = n(f.totalMin), p = n(f.picMin), pu = n(f.picusMin), sic = n(f.copilotMin);
    const mp = n(f.multiPilotMin), se = n(f.singlePilotSeMin), me = n(f.singlePilotMeMin);
    x.totalMin += total;
    x.picMin += p;
    x.picusMin += pu;
    x.sicMin += sic;
    x.dualMin += n(f.dualMin);
    x.instructorMin += n(f.instructorMin);
    x.examinerMin += n(f.examinerMin);
    x.multiPilotMin += mp;
    x.singlePilotSeMin += se;
    x.singlePilotMeMin += me;
    x.multiEngineMin += me + mp;
    const e = engine(f.aircraftTypeIcao, total);
    pic(e, p, me + mp);
    if (f.aircraftTypeIcao) {
      const r = row(f.aircraftTypeIcao.toUpperCase());
      r.totalMin += total;
      r.picMin += p;
      r.picusMin += pu;
      r.sicMin += sic;
    }
  }
  for (const o of opening) {
    if (o.deletedAt) continue;
    const total = n(o.totalMin), p = n(o.picMin);
    const mp = n(o.multiPilotMin), se = n(o.singlePilotSeMin), me = n(o.singlePilotMeMin);
    x.totalMin += total;
    x.picMin += p;
    x.sicMin += n(o.copilotMin);
    x.dualMin += n(o.dualMin);
    x.instructorMin += n(o.instructorMin);
    x.multiPilotMin += mp;
    x.singlePilotSeMin += se;
    x.singlePilotMeMin += me;
    x.multiEngineMin += me + mp;
    x.simMin += n(o.fstdMin);
    x.unknown.openingPicMin += p;
    if (!o.aircraftTypeIcao) {
      x.unknown.openingNoTypeMin += total;
      continue;
    }
    const e = engine(o.aircraftTypeIcao, total);
    pic(e, p, me + mp);
    const r = row(o.aircraftTypeIcao.toUpperCase());
    r.totalMin += total;
    r.picMin += p;
    r.sicMin += n(o.copilotMin);
  }
  return x;
}

/** PIC as some formats print it (EASA logbook columns, some airline forms): PIC + PICUS. Label it as such. */
export const picIncludingPicus = (x: Pick<Experience, "picMin" | "picusMin">) => x.picMin + x.picusMin;
