import type { ImportField } from "./import";

/**
 * Universal import: what the apps and the server share.
 * A table (CSV, Excel) is known by the signature of its header row: once a pilot has imported such a file with
 * a column mapping, the mapping is kept under that signature and the next file of the same layout (same airline,
 * same crew software) is mapped at once, for every pilot.
 */

/** FNV-1a 32-bit, hex: short and stable (no names stored, only column titles). */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The layout of a table, from its column titles (case, accents and spacing ignored). */
export function tableSignature(header: string[]): string {
  const cols = header.map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ""));
  return `t${cols.length}-${fnv(cols.join("|"))}`;
}

/** A mapping as stored: field → column title (titles survive a column moved or added). */
export type StoredMapping = Partial<Record<ImportField, string>>;

export function mappingToTitles(header: string[], mapping: Record<ImportField, number>): StoredMapping {
  const out: StoredMapping = {};
  for (const [f, i] of Object.entries(mapping) as [ImportField, number][]) if (i >= 0 && header[i]) out[f] = header[i];
  return out;
}

export function titlesToMapping(header: string[], stored: StoredMapping, fields: ImportField[]): Record<ImportField, number> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const m = Object.fromEntries(fields.map((f) => [f, -1])) as Record<ImportField, number>;
  for (const [f, title] of Object.entries(stored) as [ImportField, string][]) {
    const i = header.findIndex((h) => norm(h) === norm(title));
    if (i >= 0) m[f] = i;
  }
  return m;
}

/** Whether an automatic mapping is good enough to import without help: a date, both airports, and a time. */
export function mappingUsable(m: Record<ImportField, number>): boolean {
  return m.date >= 0 && m.dep >= 0 && m.arr >= 0 && (m.total >= 0 || (m.out >= 0 && m.in >= 0) || (m.off >= 0 && m.on >= 0));
}
