import { describe, expect, it } from "vitest";
import { accessFor } from "../src";

describe("no-card trial", () => {
  const now = new Date("2026-11-21T17:00:00Z");
  // the app was first opened months ago (local logbook), the account was created today
  const pilot = { createdAt: "2026-06-01T10:00:00Z", subscriptionTier: "free" as const, subscriptionExpiresAt: null };

  it("runs from the account's creation, not from the app's first opening", () => {
    const a = accessFor(pilot as never, { signedIn: true, now, noCardTrialDays: 30, accountCreatedAt: "2026-11-21T15:54:37Z" });
    expect(a.canWrite).toBe(true);
    expect(a.trial).toBe(true);
    expect(a.daysLeft).toBe(30);
  });

  it("ends 30 days after the account was created", () => {
    const a = accessFor(pilot as never, { signedIn: true, now, noCardTrialDays: 30, accountCreatedAt: "2026-10-01T00:00:00Z" });
    expect(a.canWrite).toBe(false);
  });
});
