import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mergeRosterImport, parseLeonRoster, printedDutiesToEvents, stamp, type Flight, type PdfTextItem, type RosterEvent } from "../src";

const pages = JSON.parse(readFileSync(new URL("./fixtures/leon-options.json", import.meta.url), "utf8")) as PdfTextItem[][];
const opts = { pilotId: "p", rosterId: "r2", toIcao: (c: string) => c, timezoneOf: () => undefined };

describe("Leon options", () => {
  const r = parseLeonRoster(pages)!;
  it("marks the legs printed with their call sign as options", () => {
    const opt = r.events.filter((e) => e.tentative);
    expect(opt.map((e) => `${e.date} ${e.start} ${e.dep}-${e.arr} ${e.flightNumber}`)).toEqual([
      "2026-11-19 17:00 LFPB-LSGG AJD214K",
      "2026-11-19 19:00 LSGG-EGKB AJD214K",
      "2026-11-19 21:45 EGKB-LFPB AJD214K",
    ]);
    // confirmed legs are not options
    expect(r.events.filter((e) => e.kind === "FLIGHT" && !e.tentative).length).toBeGreaterThan(10);
  });
});

const ev = (o: Partial<RosterEvent>): RosterEvent => stamp({ pilotId: "p", rosterId: "r1", kind: "FLIGHT", flightId: null, ...o } as RosterEvent, "2026-11-01T00:00:00Z");

describe("mergeRosterImport", () => {
  const now = "2026-11-19T16:00:00.000Z";
  const incoming = printedDutiesToEvents(parseLeonRoster(pages)!.events, "UTC", opts);

  it("keeps a logged flight linked when its times changed, and removes duties gone from the new print", () => {
    const logged = ev({ startUtc: "2026-11-12T07:40:00.000Z", endUtc: "2026-11-12T08:50:00.000Z", depIcao: "LFPB", arrIcao: "EGSC", flightId: "f1" });
    const gone = ev({ startUtc: "2026-11-20T08:00:00.000Z", endUtc: "2026-11-20T10:00:00.000Z", depIcao: "LFPB", arrIcao: "LIRA" });
    const m = mergeRosterImport([logged, gone], incoming, [], now);
    const kept = m.put.find((e) => e.id === logged.id)!;
    expect(kept.flightId).toBe("f1");
    expect(kept.startUtc).toBe("2026-11-12T07:51:00.000Z");
    expect(m.put.find((e) => e.id === gone.id)?.deletedAt).toBe(now);
    // the leg is not added a second time
    expect(m.put.filter((e) => e.depIcao === "LFPB" && e.arrIcao === "EGSC" && e.startUtc.startsWith("2026-11-12"))).toHaveLength(1);
  });

  it("links a duty to a flight logged by hand", () => {
    const f = { id: "f9", date: "2026-11-13", depIcao: "LIML", arrIcao: "LFPB", outUtc: "2026-11-13T08:50:00.000Z", deletedAt: null } as unknown as Flight;
    const m = mergeRosterImport([], incoming, [f], now);
    expect(m.put.find((e) => e.depIcao === "LIML" && e.arrIcao === "LFPB" && e.startUtc.startsWith("2026-11-13"))?.flightId).toBe("f9");
    expect(m.linked).toBe(1);
  });

  it("a second import of the same print changes nothing", () => {
    const first = mergeRosterImport([], incoming, [], now).put;
    const again = mergeRosterImport(first, incoming, [], now);
    expect(again.added + again.updated + again.removed).toBe(0);
    expect(again.unchanged).toBe(incoming.length);
  });

  it("an option confirmed later is updated in place", () => {
    const first = mergeRosterImport([], incoming, [], now).put;
    const confirmed = incoming.map((e) => (e.tentative ? { ...e, tentative: false } : e));
    const m = mergeRosterImport(first, confirmed, [], now);
    expect(m.updated).toBe(3);
    expect(m.added).toBe(0);
  });
});
