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
