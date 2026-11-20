import { addDays, type Flight, type OpeningBalance } from "@cielo/core";
import type { FlightExperience, TypeHours } from "./types";

export interface TypeInfo {
  icao: string;
  manufacturer: string;
  model: string;
  category: string;
  engineType: string;
  multiPilot: boolean;
}

/** All the hour categories a pilot CV / airline screening asks for, from the logbook. */
export function flightExperience(flights: Flight[], opening: OpeningBalance[], typeOf: (icao: string) => TypeInfo | undefined, today: string): FlightExperience {
  const e: FlightExperience = {
    asOf: today, totalMin: 0, picMin: 0, picusMin: 0, copilotMin: 0, dualMin: 0, instructorMin: 0, multiPilotMin: 0, singlePilotSeMin: 0,
    singlePilotMeMin: 0, multiEngineMin: 0, jetMin: 0, turbopropMin: 0, turbineMin: 0, pistonMin: 0, helicopterMin: 0, nightMin: 0, ifrMin: 0,
    actualImcMin: 0, fstdMin: 0, landings: 0, last12mMin: 0, last90dMin: 0, sectors: 0, byType: [],
  };
  const types = new Map<string, TypeHours>();
  const d12 = addDays(today, -364);
  const d90 = addDays(today, -89);

  const byEngine = (icao: string | undefined | null, min: number) => {
    const t = icao ? typeOf(icao) : undefined;
    if (!t) return t;
    if (t.category === "helicopter") e.helicopterMin += min;
    if (t.engineType === "jet") e.jetMin += min;
    else if (t.engineType === "turboprop") e.turbopropMin += min;
    else if (t.engineType === "piston") e.pistonMin += min;
    if (t.engineType === "jet" || t.engineType === "turboprop" || t.engineType === "turboshaft") e.turbineMin += min;
    return t;
  };
  const typeRow = (icao: string, t: TypeInfo | undefined) => {
    let row = types.get(icao);
    if (!row) {
      row = { icao, name: t ? `${t.manufacturer} ${t.model}` : icao, category: t?.category ?? "airplane", engineType: t?.engineType ?? "", multiPilot: !!t?.multiPilot, totalMin: 0, picMin: 0, picusMin: 0, copilotMin: 0 };
      types.set(icao, row);
    }
    return row;
  };

  for (const f of flights) {
    if (f.deletedAt) continue;
    if (f.isFstd) {
      e.fstdMin += f.fstdMin;
      continue;
    }
    e.sectors++;
    e.totalMin += f.totalMin;
    e.picMin += f.picMin;
    e.picusMin += f.picusMin;
    e.copilotMin += f.copilotMin;
    e.dualMin += f.dualMin;
    e.instructorMin += f.instructorMin + f.examinerMin;
    e.multiPilotMin += f.multiPilotMin;
    e.singlePilotSeMin += f.singlePilotSeMin;
    e.singlePilotMeMin += f.singlePilotMeMin;
    e.multiEngineMin += f.singlePilotMeMin + f.multiPilotMin;
    e.nightMin += f.nightMin;
    e.ifrMin += f.ifrMin;
    e.actualImcMin += f.actualImcMin;
    e.landings += f.landingsDay + f.landingsNight;
    if (f.date >= d12) e.last12mMin += f.totalMin;
    if (f.date >= d90) e.last90dMin += f.totalMin;
    if (!e.lastFlight || f.date > e.lastFlight) e.lastFlight = f.date;
    const t = byEngine(f.aircraftTypeIcao, f.totalMin);
    if (f.aircraftTypeIcao) {
      const row = typeRow(f.aircraftTypeIcao, t);
      row.totalMin += f.totalMin;
      row.picMin += f.picMin;
      row.picusMin = (row.picusMin ?? 0) + f.picusMin;
      row.copilotMin += f.copilotMin;
      if (!row.lastFlown || f.date > row.lastFlown) row.lastFlown = f.date;
    }
  }
  for (const o of opening) {
    if (o.deletedAt) continue;
    e.totalMin += o.totalMin;
    e.picMin += o.picMin;
    e.copilotMin += o.copilotMin;
    e.dualMin += o.dualMin;
    e.instructorMin += o.instructorMin;
    e.multiPilotMin += o.multiPilotMin;
    e.singlePilotSeMin += o.singlePilotSeMin;
    e.singlePilotMeMin += o.singlePilotMeMin;
    e.multiEngineMin += o.singlePilotMeMin + o.multiPilotMin;
    e.nightMin += o.nightMin;
    e.ifrMin += o.ifrMin;
    e.fstdMin += o.fstdMin;
    e.landings += o.landingsDay + o.landingsNight;
    const t = byEngine(o.aircraftTypeIcao, o.totalMin);
    if (o.aircraftTypeIcao) {
      const row = typeRow(o.aircraftTypeIcao, t);
      row.totalMin += o.totalMin;
      row.picMin += o.picMin;
      row.copilotMin += o.copilotMin;
    }
  }
  e.byType = [...types.values()].sort((a, b) => b.totalMin - a.totalMin);
  return e;
}
