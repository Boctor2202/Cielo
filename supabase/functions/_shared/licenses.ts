// Copy of the alert threshold logic of packages/core/src/licenses.ts (+ daysBetween
// from packages/core/src/time.ts). Edge functions cannot import workspace packages:
// keep both in sync when changing the rules.

export interface LicenseLike {
  id: string;
  validUntil?: string | null;
  alertDays?: number[] | null;
  deletedAt?: string | null;
}

export const DEFAULT_ALERT_DAYS = [90, 30, 7];

/** Whole days from date a to date b (YYYY-MM-DD or ISO strings, UTC). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

/** Alerts due today: a license crosses one of its thresholds exactly today, or expires today. */
export function alertsDueToday<L extends LicenseLike>(licenses: L[], today: string): { license: L; daysLeft: number }[] {
  const out: { license: L; daysLeft: number }[] = [];
  for (const l of licenses) {
    if (l.deletedAt || !l.validUntil) continue;
    const d = daysBetween(today, l.validUntil);
    const th = l.alertDays?.length ? l.alertDays : DEFAULT_ALERT_DAYS;
    if (th.includes(d) || d === 0) out.push({ license: l, daysLeft: d });
  }
  return out;
}
