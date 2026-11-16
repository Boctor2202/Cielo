import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AircraftType, Flight, Pilot, TableName } from "@cielo/core";
import { createSupabaseSync, lastPullKey, lastPushKey } from "../src/index";
import { FakeSupabase, MemoryStore } from "./fakes";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function flight(id: string, updatedAt: string, extra: Partial<Flight> = {}): Flight {
  return {
    id, createdAt: updatedAt, updatedAt, deletedAt: null, pilotId: ME, date: "2026-11-10", source: "manual",
    depIcao: "LFPG", arrIcao: "LFML", totalMin: 80, airMin: 70, singlePilotSeMin: 0, singlePilotMeMin: 0, multiPilotMin: 80,
    function: "SIC", picMin: 0, picusMin: 0, copilotMin: 80, dualMin: 0, instructorMin: 0, examinerMin: 0,
    nightMin: 0, ifrMin: 80, actualImcMin: 0, xcMin: 80, nightCalc: "auto", takeoffsDay: 1, takeoffsNight: 0,
    landingsDay: 1, landingsNight: 0, pilotFlying: true, approaches: [{ type: "ILS", runway: "31R", count: 1 }],
    isFstd: false, fstdMin: 0, crew: [{ name: "J. Dupont", role: "CDB" }], locked: false, ...extra,
  };
}

function setup(tables: TableName[] = ["flights"]) {
  const store = new MemoryStore();
  const fake = new FakeSupabase(ME);
  const sync = createSupabaseSync({ supabase: fake as unknown as SupabaseClient, store, pilotId: ME, tables, pullPageSize: 2, pushBatchSize: 2 });
  return { store, fake, sync };
}

describe("push", () => {
  it("upserts local changes as snake_case rows and advances lastPush", async () => {
    const { store, fake, sync } = setup();
    await store.bulkPut("flights", [flight("f1", "2026-11-10T08:00:00.000Z"), flight("f2", "2026-11-10T09:00:00.000Z", { picName: undefined }), flight("f3", "2026-11-10T10:00:00.000Z")]);

    const res = await sync.syncNow();
    expect(res.ok).toBe(true);
    expect(res.pushed.flights).toBe(3);
    const row = fake.table("flights").get("f2")!;
    expect(row.pilot_id).toBe(ME);
    expect(row.dep_icao).toBe("LFPG");
    expect(row.copilot_min).toBe(80);
    expect(row.approaches).toEqual([{ type: "ILS", runway: "31R", count: 1 }]);
    expect(row.pic_name).toBeNull(); // undefined -> null
    expect(store.meta.get(lastPushKey("flights"))).toBe("2026-11-10T10:00:00.000Z");
    expect(fake.requests.filter((r) => r.op === "upsert")).toHaveLength(2); // batches of 2

    // nothing new: no upsert at all
    fake.requests = [];
    const again = await sync.syncNow();
    expect(again.pushed.flights).toBe(0);
    expect(fake.requests.some((r) => r.op === "upsert")).toBe(false);
  });

  it("skips public aircraft types and rows of other pilots", async () => {
    const { store, fake, sync } = setup(["aircraft_types"]);
    const base = { createdAt: "2026-11-10T08:00:00.000Z", updatedAt: "2026-11-10T08:00:00.000Z", icao: "C172", manufacturer: "Cessna", model: "172", category: "airplane", engineType: "piston", engineCount: 1, multiPilot: false } as const;
    await store.bulkPut("aircraft_types", [
      { ...base, id: "ref-C172", ownerPilotId: null } as AircraftType,
      { ...base, id: "t-mine", ownerPilotId: ME } as AircraftType,
      { ...base, id: "t-other", ownerPilotId: OTHER } as AircraftType,
    ]);
    const res = await sync.syncNow();
    expect(res.errors).toEqual([]);
    expect(res.pushed.aircraft_types).toBe(1);
    expect([...fake.table("aircraft_types").keys()]).toEqual(["t-mine"]);
  });

  it("only pushes the pilot's own profile row", async () => {
    const { store, fake, sync } = setup(["pilots"]);
    const p = (id: string) => ({ id, createdAt: "2026-11-10T08:00:00.000Z", updatedAt: "2026-11-10T08:00:00.000Z", email: "a@b.c", fullName: "A", locale: "fr", regulatoryFramework: "EASA", defaultFunction: "PIC", defaultIfr: "ask", defaultPilotFlying: "always", timeDisplay: "hhmm", subscriptionTier: "free", subscriptionSource: null }) as Pilot;
    await store.bulkPut("pilots", [p(ME), p(OTHER)]);
    const res = await sync.syncNow();
    expect(res.ok).toBe(true);
    expect([...fake.table("pilots").keys()]).toEqual([ME]);
  });
});

describe("pull", () => {
  it("pulls server rows page by page, maps them to camelCase and normalizes timestamps", async () => {
    const { store, fake, sync } = setup();
    for (let i = 1; i <= 5; i++) {
      fake.seed("flights", { id: `s${i}`, pilot_id: ME, date: "2026-11-01", dep_icao: "LFBO", arr_icao: "LFPO", updated_at: `2026-11-0${i}T12:00:00.000Z`, created_at: "2026-11-01T00:00:00.000Z", deleted_at: null, out_utc: "2026-11-01T06:00:00.000Z", total_min: 75 }, "123");
    }
    fake.seed("flights", { id: "x", pilot_id: OTHER, updated_at: "2026-11-09T00:00:00.000Z" }); // hidden by RLS

    const res = await sync.syncNow();
    expect(res.errors).toEqual([]);
    expect(res.pulled.flights).toBe(5);
    const local = (await store.get("flights", "s3"))!;
    expect(local.depIcao).toBe("LFBO");
    expect(local.totalMin).toBe(75);
    expect(local.updatedAt).toBe("2026-11-03T12:00:00.000Z");
    expect(local.outUtc).toBe("2026-11-01T06:00:00.000Z");
    expect("deletedAt" in local).toBe(false); // nulls are dropped by rowFromDb
    expect(await store.get("flights", "x")).toBeUndefined();
    // watermark keeps the raw server value (microsecond precision)
    expect(store.meta.get(lastPullKey("flights"))).toBe("2026-11-05T12:00:00.000123+00:00");

    // second run: only the watermark row is re-read, and it is not newer -> nothing written
    const again = await sync.syncNow();
    expect(again.pulled.flights).toBe(0);
  });

  it("does not loop or skip when many rows share the same updated_at", async () => {
    const { store, fake, sync } = setup();
    for (let i = 0; i < 7; i++) fake.seed("flights", { id: `same-${i}`, pilot_id: ME, updated_at: "2026-11-10T00:00:00.000Z" }, "456");
    const res = await sync.syncNow();
    expect(res.errors).toEqual([]);
    expect(res.pulled.flights).toBe(7);
    expect(await store.all("flights")).toHaveLength(7);
  });

  it("last write wins: keeps the newer local copy, takes the newer server copy", async () => {
    const { store, fake, sync } = setup();
    // local newer than server for f1, older for f2
    await store.bulkPut("flights", [flight("f1", "2026-11-10T10:00:00.000Z", { remarks: "local" }), flight("f2", "2026-11-10T08:00:00.000Z", { remarks: "local" })]);
    await store.setMeta(lastPushKey("flights"), "2026-11-10T12:00:00.000Z"); // pretend already pushed
    fake.seed("flights", { id: "f1", pilot_id: ME, remarks: "server", updated_at: "2026-11-10T09:00:00.000Z" });
    fake.seed("flights", { id: "f2", pilot_id: ME, remarks: "server", updated_at: "2026-11-10T09:00:00.000Z" });

    await sync.syncNow();
    expect((await store.get("flights", "f1"))!.remarks).toBe("local");
    expect((await store.get("flights", "f2"))!.remarks).toBe("server");
  });

  it("does not let a stale push overwrite a newer server row", async () => {
    const { store, fake, sync } = setup();
    fake.seed("flights", { id: "f1", pilot_id: ME, remarks: "server", updated_at: "2026-11-10T11:00:00.000Z" });
    await store.bulkPut("flights", [flight("f1", "2026-11-10T10:00:00.000Z", { remarks: "local" })]);
    await sync.syncNow();
    expect(fake.table("flights").get("f1")!.remarks).toBe("server");
    expect((await store.get("flights", "f1"))!.remarks).toBe("server");
  });

  it("pulls public reference aircraft types", async () => {
    const { store, fake, sync } = setup(["aircraft_types"]);
    fake.seed("aircraft_types", { id: "ref-A320", icao: "A320", owner_pilot_id: null, multi_pilot: true, updated_at: "2026-11-01T00:00:00.000Z" });
    fake.seed("aircraft_types", { id: "t-other", icao: "XX", owner_pilot_id: OTHER, updated_at: "2026-11-01T00:00:00.000Z" });
    await sync.syncNow();
    expect((await store.get("aircraft_types", "ref-A320"))!.multiPilot).toBe(true);
    expect(await store.get("aircraft_types", "t-other")).toBeUndefined();
  });
});

describe("failures", () => {
  it("never throws when offline and keeps watermarks so the next run catches up", async () => {
    for (const throwWhenOffline of [false, true]) {
      const { store, fake, sync } = setup(["flights", "licenses"]);
      await store.bulkPut("flights", [flight("f1", "2026-11-10T08:00:00.000Z")]);
      fake.offline = true;
      fake.throwWhenOffline = throwWhenOffline;

      const res = await sync.syncNow();
      expect(res.ok).toBe(false);
      expect(res.errors.map((e) => `${e.table}:${e.phase}`)).toEqual(["flights:push", "flights:pull", "licenses:pull"]); // nothing to push for licenses
      expect(res.errors[0]!.message).toMatch(/Failed to fetch/);
      expect(store.meta.get(lastPushKey("flights"))).toBeUndefined();

      fake.offline = false;
      const back = await sync.syncNow();
      expect(back.ok).toBe(true);
      expect(back.pushed.flights).toBe(1);
      expect(fake.table("flights").has("f1")).toBe(true);
    }
  });

  it("an error on one table does not stop the others, and partial pushes advance the watermark", async () => {
    const { store, fake, sync } = setup(["flights", "licenses"]);
    await store.bulkPut("flights", [flight("f1", "2026-11-10T08:00:00.000Z")]);
    await store.bulkPut("licenses", [{ id: "l1", createdAt: "2026-11-10T08:00:00.000Z", updatedAt: "2026-11-10T08:00:00.000Z", pilotId: ME, kind: "medical", code: "Class 1", alertDays: [90, 30] }]);
    fake.failUpsertFor.add("flights");
    const res = await sync.syncNow();
    expect(res.errors).toEqual([{ table: "flights", phase: "push", message: "boom flights" }]);
    expect(res.pushed.licenses).toBe(1);
    expect(fake.table("licenses").get("l1")!.alert_days).toEqual([90, 30]);
  });
});

describe("scheduling", () => {
  it("coalesces concurrent syncNow calls and runs on an interval", async () => {
    vi.useFakeTimers();
    try {
      const { fake, sync } = setup();
      const [a, b] = [sync.syncNow(), sync.syncNow()];
      expect(a).toBe(b);
      await a;
      const selectsAfterFirst = fake.requests.filter((r) => r.op === "select").length;

      sync.start(1000);
      await vi.advanceTimersByTimeAsync(2500); // immediate run + 2 ticks
      sync.stop();
      const selects = fake.requests.filter((r) => r.op === "select").length - selectsAfterFirst;
      expect(selects).toBe(3);
      await vi.advanceTimersByTimeAsync(5000);
      expect(fake.requests.filter((r) => r.op === "select").length - selectsAfterFirst).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("server-owned fields", () => {
  it("brings the subscription back from the server even when the local profile is newer", async () => {
    const { store, fake, sync } = setup(["pilots"]);
    const local = { id: ME, createdAt: "2026-11-10T08:00:00.000Z", updatedAt: "2026-11-16T09:59:04.940Z", email: "a@b.c", fullName: "A", locale: "fr", regulatoryFramework: "EASA", defaultFunction: "PIC", defaultIfr: "ask", defaultPilotFlying: "always", timeDisplay: "hhmm", subscriptionTier: "free", subscriptionSource: null } as Pilot;
    await store.bulkPut("pilots", [local]);
    // the database granted Max; the client copy is newer and says free (the DB trigger refuses client tier changes)
    fake.seed("pilots", { id: ME, created_at: "2026-11-10T08:00:00.000Z", updated_at: "2026-11-15T10:00:00.000Z", subscription_tier: "premium", subscription_source: null, subscription_expires_at: null });
    const res = await sync.syncNow();
    expect(res.errors).toEqual([]);
    const after = (await store.get("pilots", ME)) as Pilot;
    expect(after.subscriptionTier).toBe("premium");
    // local edit time untouched: no endless push loop
    expect(after.updatedAt).toBe("2026-11-16T09:59:04.940Z");
  });
});
