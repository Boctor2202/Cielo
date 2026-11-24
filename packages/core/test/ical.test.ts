import { describe, expect, it } from "vitest";
import { icalToRosterEvent, parseIcal } from "../src";

const IATA: Record<string, string> = { CDG: "LFPG", JFK: "KJFK", FRA: "EDDF", ORY: "LFPO", NCE: "LFMN" };
const toIcao = (c: string) => IATA[c];

/** Roster calendars as crew apps export them: UTC times, a time zone by name, Outlook zones, all-day days off. */
describe("roster calendars (iCal)", () => {
  it("UTC times, folded lines and escaped text", () => {
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Crew//EN",
      "BEGIN:VEVENT", "UID:abc-1", "DTSTART:20240315T081000Z", "DTEND:20240315T163500Z",
      "SUMMARY:AF006 CDG-JFK", "DESCRIPTION:Report 07:10Z\\, A350\\nHotel: Lexington",
      "  Ave", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [e] = parseIcal(ics);
    expect(e).toMatchObject({ uid: "abc-1", startUtc: "2024-03-15T08:10:00.000Z", endUtc: "2024-03-15T16:35:00.000Z" });
    expect(e!.description).toBe("Report 07:10Z, A350\nHotel: Lexington Ave");
    expect(icalToRosterEvent(e!, "p", toIcao)).toMatchObject({ kind: "FLIGHT", depIcao: "LFPG", arrIcao: "KJFK", flightNumber: "AF006" });
  });

  it("local times with an IANA zone, and with an Outlook (Windows) zone", () => {
    const ev = (tz: string) =>
      parseIcal(["BEGIN:VCALENDAR", "BEGIN:VEVENT", `DTSTART;TZID=${tz}:20240715T061000`, `DTEND;TZID=${tz}:20240715T074500`, "SUMMARY:LH1029 FRA-NCE", "END:VEVENT", "END:VCALENDAR"].join("\n"))[0]!;
    // Paris / Frankfurt are UTC+2 in July
    expect(ev("Europe/Berlin").startUtc).toBe("2024-07-15T04:10:00.000Z");
    expect(ev("W. Europe Standard Time").startUtc).toBe("2024-07-15T04:10:00.000Z");
    expect(ev("\"Romance Standard Time\"").endUtc).toBe("2024-07-15T05:45:00.000Z");
  });

  it("days off, standby and deadhead, times between the airports", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20240316", "DTEND;VALUE=DATE:20240317", "SUMMARY:OFF", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART:20240317T050000Z", "DTEND:20240317T130000Z", "SUMMARY:SBY ORY", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART:20240318T100000Z", "DTEND:20240318T113500Z", "SUMMARY:DH AF7700 ORY-NCE", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART:20240319T103000Z", "DTEND:20240319T185500Z", "SUMMARY:AF006 CDG 1030 JFK 1855", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const ev = parseIcal(ics).map((e) => icalToRosterEvent(e, "p", toIcao));
    expect(ev.map((e) => e.kind)).toEqual(["OFF", "STANDBY", "DEADHEAD", "FLIGHT"]);
    expect(ev[0]!.startUtc).toBe("2024-03-16T00:00:00.000Z");
    expect(ev[2]).toMatchObject({ depIcao: "LFPO", arrIcao: "LFMN", flightNumber: "AF7700" });
    expect(ev[3]).toMatchObject({ depIcao: "LFPG", arrIcao: "KJFK" });
  });
});

describe("whole-day rotation events", () => {
  const ics = (dt: string, desc: string) => `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:rot-1
SUMMARY:MCR351R3U - 1ON
DESCRIPTION:${desc}
${dt}
END:VEVENT
END:VCALENDAR`;
  const iata = (c: string) => ({ CDG: "LFPG", GVA: "LSGG", ORY: "LFPO" } as Record<string, string>)[c];

  it("does not read the legs of an all-day rotation as a positioning", () => {
    const [ev] = parseIcal(ics("DTSTART;VALUE=DATE:20261125\nDTEND;VALUE=DATE:20261126", "MEP ORY-CDG\\nAF1542 CDG-GVA\\nAF1543 GVA-CDG\\nHOTEL"));
    expect(ev!.allDay).toBe(true);
    const r = icalToRosterEvent(ev!, "p", iata);
    expect(r.kind).toBe("OTHER");
    expect(r.depIcao).toBeUndefined();
  });

  it("still reads a day off from an all-day event's notes", () => {
    const [ev] = parseIcal(ics("DTSTART;VALUE=DATE:20261129\nDTEND;VALUE=DATE:20261130", "Repos"));
    expect(icalToRosterEvent(ev!, "p", iata).kind).toBe("OFF");
  });

  it("keeps reading a timed positioning from its notes", () => {
    const [ev] = parseIcal(ics("DTSTART:20261125T061500Z\nDTEND:20261125T072500Z", "MEP CDG-GVA"));
    expect(icalToRosterEvent(ev!, "p", iata).kind).toBe("DEADHEAD");
  });
});

describe("rotation titles and duties at base", () => {
  const one = (summary: string, dt: string, desc = "") =>
    parseIcal(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nSUMMARY:${summary}\nDESCRIPTION:${desc}\n${dt}\nEND:VEVENT\nEND:VCALENDAR`)[0]!;
  const iata = (c: string) => ({ CDG: "LFPG", IST: "LTFM", MXP: "LIMC", ATL: "KATL" } as Record<string, string>)[c];

  it("does not read the layover stations of a multi-day rotation as a flight", () => {
    const r = icalToRosterEvent(one("MCR353N8D - 3ON - IST MXP ", "DTSTART;VALUE=DATE:20261118\nDTEND;VALUE=DATE:20261121"), "p", iata);
    expect(r.kind).toBe("OTHER");
    expect(r.depIcao).toBeUndefined();
  });

  it("does not make a flight of a duty at base whose notes name the base twice", () => {
    const r = icalToRosterEvent(one("CONV ATL [SST]", "DTSTART:20261123T070000Z\nDTEND:20261123T110000Z", "CDG 0700 CDG 1100"), "p", iata);
    expect(r.kind).not.toBe("FLIGHT");
    expect(r.depIcao).toBeUndefined();
  });

  it("still reads a flight from its title", () => {
    const r = icalToRosterEvent(one("AF1390 (CDG-IST) 223", "DTSTART:20261118T112500Z\nDTEND:20261118T145500Z"), "p", iata);
    expect([r.kind, r.depIcao, r.arrIcao, r.flightNumber]).toEqual(["FLIGHT", "LFPG", "LTFM", "AF1390"]);
  });
});
