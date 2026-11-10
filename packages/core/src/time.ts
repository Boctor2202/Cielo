/** Time helpers. Durations are integer minutes; instants are ISO UTC strings. */

export const MIN = 60_000;

export function minutesBetween(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const d = Math.round((Date.parse(b) - Date.parse(a)) / MIN);
  return Number.isFinite(d) ? d : 0;
}

/** 125 -> "2:05" ; decimal mode -> "2.1" */
export function formatDuration(min: number | null | undefined, mode: "hhmm" | "decimal" = "hhmm", blankZero = false): string {
  const m = Math.round(min ?? 0);
  if (blankZero && m === 0) return "";
  if (mode === "decimal") return (m / 60).toFixed(1);
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${h}:${mm.toString().padStart(2, "0")}`;
}

/** Accepts "2:05", "2h05", "205" (hhmm), "2.1" / "2,1" (decimal hours). Returns minutes or null. */
export function parseDuration(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Math.round(input);
  const s = input.trim().toLowerCase();
  if (s === "") return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+)\s*[:h]\s*(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d+)[.,](\d+)$/))) return Math.round(parseFloat(`${m[1]}.${m[2]}`) * 60);
  if ((m = s.match(/^(\d{3,4})$/))) {
    const v = m[1]!.padStart(4, "0");
    return Number(v.slice(0, 2)) * 60 + Number(v.slice(2));
  }
  if ((m = s.match(/^(\d{1,2})$/))) return Number(m[1]) * 60;
  return null;
}

/** "0835", "08:35", "8h35" -> {h, m} */
export function parseClock(input: string | null | undefined): { h: number; m: number } | null {
  if (!input) return null;
  const s = input.trim().toLowerCase().replace(/z$/, "");
  const m = s.match(/^(\d{1,2})\s*[:h.]?\s*(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return { h, m: mm };
}

export function formatClock(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Builds an ISO instant from a UTC date and clock, rolling to the next day(s) when the clock is before `after`. */
export function combineUtc(date: string, clock: string | null | undefined, after?: string | null): string | null {
  const c = parseClock(clock);
  if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  let t = Date.UTC(y, mo - 1, d, c.h, c.m);
  if (after) {
    const a = Date.parse(after);
    while (t < a) t += 24 * 60 * MIN;
  }
  return new Date(t).toISOString();
}

export function isoDate(d: Date | string | number): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return isoDate(t);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

export function formatDateShort(date: string, locale: "fr" | "en" = "fr"): string {
  const [y, m, d] = date.slice(0, 10).split("-");
  return locale === "fr" ? `${d}/${m}/${y!.slice(2)}` : `${d}/${m}/${y!.slice(2)}`;
}
