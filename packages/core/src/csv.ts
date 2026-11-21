/** Minimal RFC 4180 CSV reader/writer (auto-detects , ; and tab). */

/**
 * The delimiter that splits the most lines into the same number of columns, over the first lines: a title line
 * above the table ("Logbook - J. Dupont") does not decide, and a comma inside a remark does not win over ";".
 */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
  let best = { d: ",", score: -1 };
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => l.split(d).length - 1).filter((n) => n > 0);
    if (!counts.length) continue;
    const freq = new Map<number, number>();
    for (const n of counts) freq.set(n, (freq.get(n) ?? 0) + 1);
    const [mode, times] = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!;
    const score = times * 100 + Math.min(mode, 99);
    if (score > best.score) best = { d, score };
  }
  return best.d;
}

/** A spreadsheet cell as text, the way the import reads it: Excel times (dates on 30/12/1899) as HH:MM. */
export function sheetCellText(c: unknown): string {
  if (c instanceof Date) return c.getUTCFullYear() < 1901 ? c.toISOString().slice(11, 16) : c.toISOString().slice(0, 10);
  return c === null || c === undefined ? "" : String(c);
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][], delimiter = ","): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\t\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(delimiter)).join("\r\n") + "\r\n";
}
