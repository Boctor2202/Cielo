import { describe, expect, it } from "vitest";
import { feedLabel, feedUrl, mergeCalendarFeed } from "../src";

const cal = (events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join("")}END:VCALENDAR\r\n`;
const ev = (uid: string, summary: string, start: string, end: string) => `BEGIN:VEVENT\r\nUID:${uid}\r\nSUMMARY:${summary}\r\nDTSTART:${start}\r\nDTEND:${end}\r\nEND:VEVENT\r\n`;
const ctx = { pilotId: "p", rosterId: "r", existing: [] as never[], iataToIcao: (c: string) => ({ CDG: "LFPG", GVA: "LSGG" })[c] };

describe("calendar link", () => {
  it("reads webcal links and names their source", () => {
    expect(feedUrl("webcal://p01-caldav.icloud.com/published/2/abc")).toBe("https://p01-caldav.icloud.com/published/2/abc");
    expect(feedUrl("ftp://x")).toBeNull();
    expect(feedLabel("https://calendar.google.com/calendar/ical/x/private-y/basic.ics")).toBe("Google");
    expect(feedLabel("https://p01-caldav.icloud.com/published/2/abc")).toBe("iCloud");
  });
  it("keeps the duties, leaves personal entries out, then updates and removes from the next sync", () => {
    const first = mergeCalendarFeed(cal([ev("1", "AF1234 CDG-GVA", "20261201T0800Z", "20261201T0910Z"), ev("2", "Dentist", "20261202T1000Z", "20261202T1100Z"), ev("3", "SBY", "20261203T0500Z", "20261203T1300Z")]), ctx);
    expect(first).toMatchObject({ added: 2, skipped: 1 });
    expect(first.put[0]).toMatchObject({ kind: "FLIGHT", depIcao: "LFPG", arrIcao: "LSGG", externalUid: "1", rosterId: "r" });
    const existing = first.put as never[];
    // the flight moved by 30 min, the standby is gone
    const second = mergeCalendarFeed(cal([ev("1", "AF1234 CDG-GVA", "20261201T0830Z", "20261201T0940Z")]), { ...ctx, existing });
    expect(second).toMatchObject({ added: 0, updated: 1, removed: 1 });
    expect(second.put.find((e) => e.externalUid === "1")!.id).toBe(first.put[0]!.id);
    // nothing changed: nothing to save
    expect(mergeCalendarFeed(cal([ev("1", "AF1234 CDG-GVA", "20261201T0800Z", "20261201T0910Z"), ev("3", "SBY", "20261203T0500Z", "20261203T1300Z")]), { ...ctx, existing }).put).toHaveLength(0);
  });
});

describe("calendar link over other imports and the logbook", () => {
  const flight = { id: "f1", date: "2026-11-20", depIcao: "LFPG", arrIcao: "LSGG", outUtc: "2026-11-20T08:05:00.000Z" } as never;
  const printed = { id: "old", pilotId: "p", rosterId: "pdf", kind: "FLIGHT", title: "CDG GVA", startUtc: "2026-12-01T08:00:00.000Z", endUtc: "2026-12-01T09:10:00.000Z", depIcao: "LFPG", arrIcao: "LSGG", createdAt: "x", updatedAt: "x" } as never;

  it("links a duty already flown to its flight of the logbook", () => {
    const m = mergeCalendarFeed(cal([ev("a", "AF1 CDG-GVA", "20261120T0800Z", "20261120T0910Z")]), { ...ctx, flights: [flight] });
    expect(m.linked).toBe(1);
    expect(m.put[0]!.flightId).toBe("f1");
  });

  it("takes over the same duty from a printed roster instead of doubling it", () => {
    const m = mergeCalendarFeed(cal([ev("b", "AF2 CDG-GVA", "20261201T0815Z", "20261201T0925Z")]), { ...ctx, existing: [printed] });
    expect(m).toMatchObject({ added: 0, updated: 1, merged: 1 });
    expect(m.put[0]).toMatchObject({ id: "old", rosterId: "r", externalUid: "b", startUtc: "2026-12-01T08:15:00.000Z" });
  });

  it("removes the printed copy of a duty the feed already has", () => {
    const first = mergeCalendarFeed(cal([ev("b", "AF2 CDG-GVA", "20261201T0815Z", "20261201T0925Z")]), ctx);
    const m = mergeCalendarFeed(cal([ev("b", "AF2 CDG-GVA", "20261201T0815Z", "20261201T0925Z")]), { ...ctx, existing: [...(first.put as never[]), printed] });
    expect(m.merged).toBe(1);
    expect(m.put).toHaveLength(1);
    expect(m.put[0]).toMatchObject({ id: "old" });
    expect(m.put[0]!.deletedAt).toBeTruthy();
  });
});

describe("a feed whose UIDs change at each reading (Leon)", () => {
  it("recognises its duties by route and time, without doubling or removing them", () => {
    const first = mergeCalendarFeed(cal([ev("flights1-100", "Flight CDG-GVA", "20261120T0800Z", "20261120T0910Z")]), { ...ctx, flights: [{ id: "f1", date: "2026-11-20", depIcao: "LFPG", arrIcao: "LSGG", outUtc: "2026-11-20T08:00:00.000Z" } as never] });
    expect(first.put[0]!.flightId).toBe("f1");
    const again = mergeCalendarFeed(cal([ev("flights1-200", "Flight CDG-GVA", "20261120T0800Z", "20261120T0910Z")]), { ...ctx, existing: first.put as never[] });
    expect(again).toMatchObject({ added: 0, removed: 0 });
    expect(again.put).toHaveLength(0);
  });
});

describe("a printed leg with an airport missing", () => {
  it("is the same leg as the feed's at the same time", () => {
    const cut = { id: "cut", pilotId: "p", rosterId: "pdf", kind: "FLIGHT", startUtc: "2026-12-02T23:30:00.000Z", endUtc: "2026-12-02T23:59:00.000Z", depIcao: "LFPG", arrIcao: null, createdAt: "x", updatedAt: "x" } as never;
    const m = mergeCalendarFeed(cal([ev("c", "Flight CDG-GVA", "20261202T2330Z", "20261203T0026Z")]), { ...ctx, existing: [cut] });
    expect(m).toMatchObject({ added: 0, merged: 1 });
    expect(m.put[0]).toMatchObject({ id: "cut", arrIcao: "LSGG" });
  });
});
