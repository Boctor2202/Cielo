import { describe, expect, it } from "vitest";
import { rosterLayovers, unsavedRosterLayovers } from "../src/rosterLayovers";
import type { Layover, RosterEvent } from "../src/types";

const ev = (id: string, dep: string, arr: string, start: string, end: string, kind: RosterEvent["kind"] = "FLIGHT") =>
  ({ id, pilotId: "p", kind, depIcao: dep, arrIcao: arr, startUtc: start, endUtc: end, createdAt: start, updatedAt: start }) as RosterEvent;

const roster = [
  ev("1", "LFPG", "LFMN", "2026-11-20T06:00:00Z", "2026-11-20T07:30:00Z"),
  ev("2", "LFMN", "LFPG", "2026-11-20T08:30:00Z", "2026-11-20T10:00:00Z"),
  ev("3", "LFPG", "LEMD", "2026-11-21T15:00:00Z", "2026-11-21T17:00:00Z"),
  ev("4", "LEMD", "LFPG", "2026-11-22T09:00:00Z", "2026-11-22T11:00:00Z"),
  ev("5", "LFPG", "KJFK", "2026-11-25T10:00:00Z", "2026-11-25T18:00:00Z"),
  ev("6", "KJFK", "LFPG", "2026-11-27T22:00:00Z", "2026-11-28T06:00:00Z"),
];

describe("rosterLayovers", () => {
  it("finds the nights away from base, not the turnarounds", () => {
    const r = rosterLayovers(roster, "LFPG");
    expect(r.map((x) => [x.airportIcao, x.rosterEventId])).toEqual([["LEMD", "3"], ["KJFK", "5"]]);
    expect(r[0]!.departureUtc).toBe("2026-11-22T09:00:00Z");
  });
  it("guesses the base when it is not set", () => {
    expect(rosterLayovers(roster).map((x) => x.airportIcao)).toEqual(["LEMD", "KJFK"]);
  });
  it("leaves out the layovers already saved", () => {
    const saved = [{ id: "l", pilotId: "p", airportIcao: "LEMD", rosterEventId: null, arrivalUtc: "2026-11-21T12:00:00Z", contacts: [] }] as unknown as Layover[];
    const removed = [{ id: "m", pilotId: "p", airportIcao: "KJFK", rosterEventId: "5", deletedAt: "2026-11-01T00:00:00Z", contacts: [] }] as unknown as Layover[];
    expect(unsavedRosterLayovers(roster, [...saved, ...removed], "LFPG")).toEqual([]);
  });
});
