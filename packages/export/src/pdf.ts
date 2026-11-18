import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDuration, type Flight, type Totals, ZERO_TOTALS, sumFlights } from "@cielo/core";
import { LAYOUTS, type Column, type LayoutId } from "./layouts";

export interface LogbookPdfOptions {
  layout: LayoutId;
  pilotName: string;
  licenceNumber?: string;
  periodLabel?: string;
  /** Totals brought forward from previous logbook(s) — shown as "total from previous pages" on page 1. */
  opening?: Totals;
  rowsPerPage?: number;
  /** ignored: logbook exports are always in English, the language of aviation records */
  locale?: "fr" | "en";
  appName?: string;
  generatedAt?: Date;
  /** more particulars of the holder for the cover (employer, address… as some authorities ask) */
  holderDetails?: [string, string][];
}

const INK = rgb(0.04, 0.09, 0.15);
const GRID = rgb(0.55, 0.6, 0.66);
const SHADE = rgb(0.93, 0.95, 0.97);
const BRAND = rgb(0.055, 0.165, 0.278);

/** Pdf-lib standard fonts are WinAnsi: replace characters outside Latin-1 so rendering never throws. */
function safe(s: string): string {
  return s.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > width) t = t.slice(0, -1);
  return t.length > 0 ? t + "." : "";
}

export async function buildLogbookPdf(flights: Flight[], opts: LogbookPdfOptions): Promise<Uint8Array> {
  const layout = LAYOUTS[opts.layout];
  const rowsPerPage = opts.rowsPerPage ?? layout.rowsPerPage;
  const doc = await PDFDocument.create();
  doc.setTitle(`${layout.title} — ${opts.pilotName}`);
  doc.setAuthor(opts.pilotName);
  doc.setCreator(opts.appName ?? "Geardown");
  doc.setProducer(opts.appName ?? "Geardown");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const sorted = flights.filter((f) => !f.deletedAt).sort((a, b) => (a.outUtc ?? a.date).localeCompare(b.outUtc ?? b.date));
  const pages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  let previous: Totals = opts.opening ?? ZERO_TOTALS;
  const fmt = (min: number) => (layout.decimal ? (min / 60).toFixed(1) : formatDuration(min));

  // Cover page
  {
    const page = doc.addPage([842, 595]);
    const all = sumFlights(sorted, previous);
    page.drawRectangle({ x: 0, y: 515, width: 842, height: 80, color: BRAND });
    page.drawText(safe(opts.appName ?? "Geardown"), { x: 40, y: 548, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText(safe(layout.title), { x: 40, y: 528, size: 11, font, color: rgb(0.75, 0.85, 0.95) });
    const lines: [string, string][] = [
      ["Pilot", opts.pilotName],
      ["Licence number", opts.licenceNumber ?? "—"],
      ...(opts.holderDetails ?? []),
      ["Period", opts.periodLabel ?? "—"],
      ["Entries", `${sorted.length}`],
      ["Total time (incl. brought forward)", fmt(all.totalMin)],
      ["PIC", fmt(all.picMin + all.picusMin)],
      ["Night", fmt(all.nightMin)],
      ["IFR", fmt(all.ifrMin)],
      ["Landings day / night", `${all.landingsDay} / ${all.landingsNight}`],
      ["FSTD", fmt(all.fstdMin)],
    ];
    lines.forEach(([k, v], i) => {
      page.drawText(safe(k), { x: 40, y: 470 - i * 24, size: 11, font, color: GRID });
      page.drawText(safe(v), { x: 300, y: 470 - i * 24, size: 12, font: bold, color: INK });
    });
    page.drawText(safe(layout.reference), { x: 40, y: 60, size: 8, font, color: GRID });
    const gen = (opts.generatedAt ?? new Date()).toISOString().slice(0, 16).replace("T", " ");
    page.drawText(safe(`${"Generated"} ${gen} UTC`), { x: 40, y: 46, size: 8, font, color: GRID });
  }

  for (let p = 0; p < pages; p++) {
    const rows = sorted.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
    const page = doc.addPage([842, 595]);
    const thisPage = sumFlights(rows);
    const total = addTotals(previous, thisPage);
    drawPage(page, layout.columns, rows, { font, bold, rowsPerPage, thisPage, previous, total, fmt, pageNo: p + 1, pages, opts, layoutTitle: layout.title, certify: layout.certify });
    previous = total;
  }
  return doc.save();
}

function addTotals(a: Totals, b: Totals): Totals {
  const t = { ...a };
  for (const k of Object.keys(t) as (keyof Totals)[]) t[k] = a[k] + b[k];
  return t;
}

interface DrawCtx {
  font: PDFFont;
  bold: PDFFont;
  rowsPerPage: number;
  thisPage: Totals;
  previous: Totals;
  total: Totals;
  fmt: (min: number) => string;
  pageNo: number;
  pages: number;
  opts: LogbookPdfOptions;
  layoutTitle: string;
  certify: string;
}

function drawPage(page: PDFPage, columns: Column[], rows: Flight[], c: DrawCtx) {
  const marginX = 18;
  const tableW = 842 - marginX * 2;
  const unit = tableW / columns.reduce((s, col) => s + col.w, 0);
  const xs: number[] = [];
  let x = marginX;
  for (const col of columns) {
    xs.push(x);
    x += col.w * unit;
  }
  const top = 570;
  const groupH = 22;
  const subH = 20;
  const footH = 15;
  const rowH = (top - groupH - subH - 3 * footH - 48) / c.rowsPerPage;
  const fs = 6.8;

  page.drawText(safe(c.layoutTitle), { x: marginX, y: top + 8, size: 8, font: c.bold, color: INK });
  page.drawText(safe(`${c.opts.pilotName}  ·  ${c.pageNo} / ${c.pages}`), { x: 842 - marginX - 150, y: top + 8, size: 8, font: c.font, color: GRID });

  // Header: group row (merged cells) and sub row
  const headerTop = top;
  const headerBottom = headerTop - groupH - subH;
  page.drawRectangle({ x: marginX, y: headerBottom, width: tableW, height: groupH + subH, color: SHADE });
  let i = 0;
  while (i < columns.length) {
    const g = columns[i]!.group;
    let j = i;
    while (j + 1 < columns.length && columns[j + 1]!.group === g && g) j++;
    const gx = xs[i]!;
    const gw = xs[j]! + columns[j]!.w * unit - gx;
    const hasSub = !!g;
    const label = g ?? columns[i]!.sub ?? "";
    drawWrapped(page, label, gx, hasSub ? headerTop - groupH : headerBottom, gw, hasSub ? groupH : groupH + subH, c.bold, 5.6);
    if (hasSub) {
      for (let k = i; k <= j; k++) {
        drawWrapped(page, columns[k]!.sub ?? "", xs[k]!, headerBottom, columns[k]!.w * unit, subH, c.font, 5.4);
        page.drawLine({ start: { x: xs[k]!, y: headerTop - groupH }, end: { x: xs[k]!, y: headerBottom }, thickness: 0.4, color: GRID });
      }
      page.drawLine({ start: { x: gx, y: headerTop - groupH }, end: { x: gx + gw, y: headerTop - groupH }, thickness: 0.4, color: GRID });
    }
    page.drawLine({ start: { x: gx, y: headerTop }, end: { x: gx, y: headerBottom }, thickness: 0.6, color: GRID });
    i = j + 1;
  }

  // Body
  const bodyTop = headerBottom;
  for (let r = 1; r < c.rowsPerPage; r += 2) {
    page.drawRectangle({ x: marginX, y: bodyTop - (r + 1) * rowH, width: tableW, height: rowH, color: rgb(0.975, 0.98, 0.985) });
  }
  for (let r = 0; r < c.rowsPerPage; r++) {
    const y = bodyTop - (r + 1) * rowH;
    page.drawLine({ start: { x: marginX, y }, end: { x: marginX + tableW, y }, thickness: 0.3, color: GRID });
    const f = rows[r];
    if (!f) continue;
    columns.forEach((col, k) => {
      const v = col.value(f, c.fmt);
      if (!v) return;
      const w = col.w * unit - 4;
      const t = fit(v, c.font, fs, w);
      const tw = c.font.widthOfTextAtSize(t, fs);
      const tx = col.align === "left" ? xs[k]! + 2 : col.align === "center" ? xs[k]! + (col.w * unit - tw) / 2 : xs[k]! + col.w * unit - 2 - tw;
      page.drawText(t, { x: tx, y: y + rowH / 2 - fs / 2 + 1, size: fs, font: c.font, color: INK });
    });
  }
  const bodyBottom = bodyTop - c.rowsPerPage * rowH;

  // Footer totals
  const labels = [
    ["TOTAL THIS PAGE", c.thisPage],
    ["TOTAL FROM PREVIOUS PAGES", c.previous],
    ["TOTAL TIME", c.total],
  ] as const;
  const firstSum = columns.findIndex((col) => col.sum);
  labels.forEach(([label, t], li) => {
    const y = bodyBottom - (li + 1) * footH;
    page.drawRectangle({ x: marginX, y, width: tableW, height: footH, color: li === 2 ? SHADE : rgb(1, 1, 1) });
    page.drawLine({ start: { x: marginX, y }, end: { x: marginX + tableW, y }, thickness: 0.4, color: GRID });
    const labelW = (firstSum > 0 ? xs[firstSum]! : marginX + 100) - marginX - 4;
    page.drawText(fit(label, c.bold, 6.2, labelW), { x: marginX + 3, y: y + 5, size: 6.2, font: c.bold, color: INK });
    columns.forEach((col, k) => {
      if (!col.sum) return;
      const raw = col.sum(t);
      const v = col.sumKind === "count" ? String(raw) : c.fmt(raw);
      const tw = c.bold.widthOfTextAtSize(v, 6.4);
      page.drawText(v, { x: xs[k]! + col.w * unit - 2 - tw, y: y + 5, size: 6.4, font: c.bold, color: INK });
    });
  });
  const tableBottom = bodyBottom - 3 * footH;

  // Vertical grid lines over body + footer
  xs.forEach((gx, k) => {
    const isGroupStart = k === 0 || columns[k]!.group !== columns[k - 1]!.group || !columns[k]!.group;
    const bottom = k >= firstSum ? tableBottom : bodyBottom;
    page.drawLine({ start: { x: gx, y: bodyTop }, end: { x: gx, y: bottom }, thickness: isGroupStart ? 0.6 : 0.3, color: GRID });
  });
  page.drawRectangle({ x: marginX, y: tableBottom, width: tableW, height: headerTop - tableBottom, borderColor: INK, borderWidth: 0.8 });

  // Certification
  page.drawText(safe(c.certify), { x: marginX, y: tableBottom - 14, size: 7, font: c.font, color: INK });
  const sigLabel = "PILOT'S SIGNATURE";
  page.drawText(safe(sigLabel), { x: 842 - marginX - 220, y: tableBottom - 14, size: 7, font: c.bold, color: INK });
  page.drawLine({ start: { x: 842 - marginX - 130, y: tableBottom - 16 }, end: { x: 842 - marginX, y: tableBottom - 16 }, thickness: 0.5, color: GRID });
}

function drawWrapped(page: PDFPage, text: string, x: number, y: number, w: number, h: number, font: PDFFont, size: number) {
  const words = safe(text).replace(/-/g, "- ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const t = cur ? (cur.endsWith("-") ? `${cur}${word}` : `${cur} ${word}`) : word;
    if (font.widthOfTextAtSize(t, size) > w - 3 && cur) {
      lines.push(cur);
      cur = word;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, Math.max(1, Math.floor(h / (size + 1.2))));
  const total = shown.length * (size + 1.2);
  shown.forEach((line, i) => {
    const l = fit(line, font, size, w - 2);
    const tw = font.widthOfTextAtSize(l, size);
    page.drawText(l, { x: x + (w - tw) / 2, y: y + h / 2 + total / 2 - (i + 1) * (size + 1.2) + 1.5, size, font, color: INK });
  });
}
