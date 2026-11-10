"use client";

import { addDays, distanceNm, isoDate, type FlightFormInput, type PilotFunction } from "@cielo/core";
import type { AirportIndex } from "@cielo/reference-data";
import { db } from "./db";
import { buildFlight, ensurePilot, saveAircraft, saveLayover, saveLicense, saveOpening, saveRosterEvent, updatePilot, REFERENCE_TYPES } from "./repo";

/** Deterministic pseudo-random generator so the demo looks the same everywhere. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const DESTS = ["LFMN", "LFML", "LFBO", "LFBD", "LIRF", "LEMD", "LEBL", "EGLL", "EDDF", "LSGG", "LPPT", "EHAM", "LIMC", "LGAV", "GMMN", "LFRS", "LFLL", "EIDW"];
const CAPTAINS = ["Cdt A. Moreau", "Cdt L. Garnier", "Cdt S. Laurent", "Cdt J. Petit", "Cdt M. Roux"];
const REGS = ["F-HCLA", "F-HCLB", "F-HCLC", "F-HCLD"];

const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16);

export async function loadDemo(airports: AirportIndex, locale: "fr" | "en") {
  const rand = rng(42);
  const pilot = await ensurePilot(locale);
  await updatePilot({
    fullName: "Camille Martin",
    displayName: "Camille",
    email: "camille.martin@example.com",
    licenceNumber: "FRA.FCL.PA.012345",
    homeBaseIcao: "LFPG",
    defaultFunction: "SIC",
    defaultIfr: "ask",
    subscriptionTier: "premium",
  });

  const a320 = REFERENCE_TYPES.find((t) => t.icao === "A320")!;
  const dr40 = REFERENCE_TYPES.find((t) => t.icao === "DR40")!;
  for (const r of REGS) await saveAircraft({ registration: r, aircraftTypeId: a320.id, defaultOperation: "multi_pilot", operator: "Demo Air", variant: "214" });
  await saveAircraft({ registration: "F-GSTR", aircraftTypeId: dr40.id, defaultOperation: "single_pilot", operator: "Aéroclub" });

  const today = isoDate(new Date());
  const flights = [];
  let pf = false;
  let lastRelease = 0;
  for (let day = -400; day <= -1; day++) {
    const date = addDays(today, day);
    const r = rand();
    if (r < 0.62) continue;
    if (r > 0.975) {
      // Private flight at the aero club
      const start = Date.parse(`${date}T${String(8 + Math.floor(rand() * 7)).padStart(2, "0")}:${rand() > 0.5 ? "00" : "30"}:00Z`);
      const dur = 50 + Math.floor(rand() * 60);
      flights.push({
        input: {
          date, depIcao: "LFPN", arrIcao: rand() > 0.5 ? "LFPN" : "LFOP", out: clock(start), in: clock(start + dur * 60000),
          off: clock(start + 8 * 60000), on: clock(start + (dur - 6) * 60000), registration: "F-GSTR", aircraftTypeIcao: "DR40",
          function: "PIC" as PilotFunction, ifr: false, pilotFlying: true, autoLandings: true, isFstd: false, remarks: "Vol local",
        },
      });
      continue;
    }
    const dest = DESTS[Math.floor(rand() * DESTS.length)]!;
    const legs = rand() > 0.7 ? 4 : 2;
    const reg = REGS[Math.floor(rand() * REGS.length)]!;
    const captain = CAPTAINS[Math.floor(rand() * CAPTAINS.length)]!;
    const startHour = legs === 4 ? 5 + Math.floor(rand() * 3) : 5 + Math.floor(rand() * 10);
    let t = Date.parse(`${date}T${String(startHour).padStart(2, "0")}:${rand() > 0.5 ? "10" : "40"}:00Z`);
    // Keep at least 14 h between the end of the previous duty and the next off-block.
    if (t < lastRelease + 14 * 3600_000) continue;
    const route = legs === 4 ? ["LFPG", dest, "LFPG", DESTS[Math.floor(rand() * DESTS.length)]!, "LFPG"] : ["LFPG", dest, "LFPG"];
    for (let i = 0; i < route.length - 1; i++) {
      const dep = airports.get(route[i]!);
      const arr = airports.get(route[i + 1]!);
      if (!dep || !arr || dep.icao === arr.icao) continue;
      const air = Math.round((distanceNm(dep, arr) / 420) * 60 + 18);
      const taxiOut = 10 + Math.floor(rand() * 12);
      const taxiIn = 5 + Math.floor(rand() * 6);
      const out = t;
      const off = out + taxiOut * 60000;
      const on = off + air * 60000;
      const inn = on + taxiIn * 60000;
      pf = !pf;
      const input: FlightFormInput = {
        date: isoDate(out), flightNumber: `DM${1000 + Math.floor(rand() * 8000)}`, depIcao: dep.icao, arrIcao: arr.icao,
        out: clock(out), off: clock(off), on: clock(on), in: clock(inn), registration: reg, aircraftTypeIcao: "A320",
        function: day > -60 && rand() > 0.6 ? "PICUS" : "SIC", picName: captain, ifr: true, pilotFlying: pf,
        autoLandings: true, isFstd: false,
        approaches: pf ? [{ type: rand() > 0.3 ? "ILS CAT I" : "RNP", count: 1 }] : [],
      };
      flights.push({ input });
      t = inn + (40 + Math.floor(rand() * 30)) * 60000;
      lastRelease = inn;
    }
  }
  // Simulator check
  flights.push({ input: { date: addDays(today, -95), depIcao: "FSTD", arrIcao: "FSTD", function: "SIC" as PilotFunction, ifr: false, pilotFlying: true, isFstd: true, fstdType: "A320 FFS", fstdQualification: "FFS D", fstdMin: 240, remarks: "OPC / LPC" } });

  const built = [];
  for (const { input } of flights) built.push(await buildFlight(input, airports, { source: "import" }));
  await db().t("flights").bulkPut(built);

  await saveOpening({
    label: locale === "fr" ? "Carnet papier n°1" : "Paper logbook #1", asOfDate: addDays(today, -401), aircraftTypeIcao: null,
    totalMin: 1240 * 60, singlePilotSeMin: 210 * 60, singlePilotMeMin: 30 * 60, multiPilotMin: 1000 * 60, picMin: 220 * 60,
    copilotMin: 950 * 60, dualMin: 70 * 60, instructorMin: 0, nightMin: 260 * 60, ifrMin: 980 * 60, landingsDay: 420,
    landingsNight: 95, fstdMin: 64 * 60,
  });

  const lic = (kind: Parameters<typeof saveLicense>[0]["kind"], code: string, validUntil: string | null, extra: Partial<Parameters<typeof saveLicense>[0]> = {}) =>
    saveLicense({ kind, code, validUntil, alertDays: [90, 30, 7], authority: "DGAC France", ...extra });
  await lic("licence", "ATPL(A)", null, { number: "FRA.FCL.PA.012345", issuedOn: "2021-03-15" });
  await lic("medical", "Class 1", addDays(today, 25), { issuedOn: addDays(today, -340), authority: "AeMC" });
  await lic("rating", "TR A320 + IR", addDays(today, 140), { lastCheckOn: addDays(today, -95) });
  await lic("rating", "SEP(land)", addDays(today, 300));
  await lic("language", "LPE English", null, { notes: "Level 6" });
  await lic("other", "Dangerous goods", addDays(today, -4));
  await lic("other", "Passport", addDays(today, 900), { authority: "République française" });

  // Upcoming roster
  const plan: [number, string, string, string, string?][] = [
    [1, "FLIGHT", "06:20", "08:05", "LFPG-LIRF"],
    [1, "FLIGHT", "09:10", "11:15", "LIRF-LFPG"],
    [2, "STANDBY", "05:00", "17:00"],
    [3, "OFF", "00:00", "23:59"],
    [4, "FLIGHT", "13:40", "15:55", "LFPG-LPPT"],
    [5, "FLIGHT", "08:30", "10:35", "LPPT-LFPG"],
    [7, "SIM", "06:00", "10:00"],
    [9, "FLIGHT", "05:55", "07:20", "LFPG-EGLL"],
    [9, "FLIGHT", "08:25", "09:40", "EGLL-LFPG"],
  ];
  for (const [d, kind, s, e, route] of plan) {
    const date = addDays(today, d);
    const [dep, arr] = route?.split("-") ?? [];
    const ev = await saveRosterEvent({
      kind: kind as "FLIGHT", title: route ? `DM${2000 + d} ${route}` : kind, startUtc: `${date}T${s}:00.000Z`, endUtc: `${date}T${e}:00.000Z`,
      reportUtc: kind === "FLIGHT" ? new Date(Date.parse(`${date}T${s}:00.000Z`) - 60 * 60000).toISOString() : null,
      flightNumber: route ? `DM${2000 + d}` : undefined, depIcao: dep, arrIcao: arr, aircraftTypeIcao: route ? "A320" : undefined,
    });
    if (arr === "LPPT") {
      await saveLayover({
        airportIcao: "LPPT", rosterEventId: ev.id, arrivalUtc: ev.endUtc, hotelName: "Hôtel (exemple)", address: "—",
        notes: locale === "fr" ? "Navette équipage à la sortie 2, toutes les 20 min." : "Crew shuttle at exit 2, every 20 min.",
        contacts: [{ name: "Ops", phone: "+351 000 000 000", role: "Handling" }],
      });
    }
  }
  return pilot;
}
