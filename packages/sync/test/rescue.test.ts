import { describe, expect, it } from "vitest";
import { restoreLogbook, snapshotLogbook, unsyncedCount } from "../src";
import { MemoryStore } from "./fakes";

const flight = (id: string, updatedAt: string, pilotId = "p1") => ({ id, pilotId, updatedAt, createdAt: updatedAt, deletedAt: null, date: "2026-11-21", depIcao: "LFPN", arrIcao: "LFOX" });

describe("logbook rescue (sign-out without network)", () => {
  it("counts what this device has not pushed, keeps a copy, and brings it back after the account's data is pulled", async () => {
    const store = new MemoryStore();
    await store.setMeta("lastPush:flights", "2026-11-21T10:00:00.000Z");
    await store.bulkPut("flights", [flight("old", "2026-11-21T09:00:00.000Z"), flight("new", "2026-11-21T11:00:00.000Z"), flight("other", "2026-11-21T11:00:00.000Z", "p2")] as never);
    expect(await unsyncedCount(store, "p1")).toBe(1);
    const copy = await snapshotLogbook(store, "p1");
    expect(copy.rows.flights?.map((r) => r.id).sort()).toEqual(["new", "old"]);

    // sign-out cleared the device; signing in again pulled the server, which only had "old"
    await store.clear();
    await store.bulkPut("flights", [flight("old", "2026-11-21T09:00:00.000Z")] as never);
    await store.setMeta("lastPush:flights", "2026-11-21T09:00:00.000Z");
    expect(await restoreLogbook(store, copy)).toBe(1);
    // the restored flight is newer than the push mark: the next sync sends it
    expect(await unsyncedCount(store, "p1")).toBe(1);
    expect(await store.get("flights", "new")).toBeTruthy();
  });
});
