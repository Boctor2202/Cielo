import { hasScript, mixedWidth, runs } from "./script";
import { LANG_TAG, type CvLocale } from "./types";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument, PDFName, PDFString, StandardFonts, appendBezierCurve, clip, closePath, endPath, moveTo, popGraphicsState, pushGraphicsState, rgb,
  type PDFFont, type PDFPage, type RGB,
} from "pdf-lib";
import type { CvDocument, Line, Section } from "./document";
import type { CvTheme } from "./types";

/**
 * A4 CV with a designed layout that stays machine-readable: every word is real text drawn in reading order
 * (header, key figures, then the sections top to bottom), no text in images, the structured JSON Resume
 * attached inside the PDF and the keywords in the metadata. Nothing in it names the software that made it.
 */

const W = 595.28;
const H = 841.89;
const M = 42;
const CW = W - 2 * M;

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

export const CV_THEMES: Record<CvTheme, { dark: string; accent: string; tint: string; swatch: string }> = {
  navy: { dark: "#0E2A47", accent: "#2F6FAE", tint: "#EEF3F8", swatch: "#0E2A47" },
  burgundy: { dark: "#43141F", accent: "#9B2C42", tint: "#F8EEF0", swatch: "#6B1E2F" },
  forest: { dark: "#14352A", accent: "#2E7A55", tint: "#EDF5F0", swatch: "#1F4D3B" },
  graphite: { dark: "#1E2227", accent: "#A9823A", tint: "#F4F1EA", swatch: "#2B2F35" },
};

const INK = hex("#16202C");
const MUTED = hex("#5B6878");
const RULE = hex("#DCE2E9");
const WHITE = rgb(1, 1, 1);

/** Standard PDF fonts are WinAnsi: map typographic characters, drop the rest. */
function winAnsi(s: string): string {
  return s
    .replace(/[–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, "");
}

export interface CvFonts {
  regular: Uint8Array;
  semibold: Uint8Array;
  bold: Uint8Array;
  /** a second font for Chinese or Arabic labels (the Latin font draws everything else) */
  script?: { regular: Uint8Array; semibold: Uint8Array; bold: Uint8Array };
}

export interface CvPdfOptions {
  jsonResume?: unknown;
  author?: string;
  lang?: CvLocale;
  theme?: CvTheme;
  /** TrueType fonts to embed (Inter); without them the standard Helvetica is used */
  fonts?: CvFonts;
  /** profile photo, PNG or JPEG bytes */
  photo?: Uint8Array;
}

/** hour categories kept on the page (the full breakdown stays in the text and JSON Resume versions) */
const HOURS_KEPT = ["total", "pic", "picus", "copilot", "multiPilot", "multiEngine", "turbine", "jet", "helicopter", "night", "ifr", "instructor", "last12m"];
const HOURS_SHORT = ["total", "pic", "copilot", "multiPilot", "turbine", "helicopter", "night", "ifr"];

/**
 * Density levels, tried in order until the CV fits on one page: each one drops a little more detail (the full
 * breakdown stays in the text and JSON Resume versions) and tightens the spacing.
 */
interface Density {
  /** vertical gaps between sections and entries */
  gap: number;
  /** header band and key figures, tighter */
  tight: boolean;
  /** licences on one line each (code and validity), on this many columns; 0 keeps the full entries */
  licCols: number;
  types: number;
  typeMeta: boolean;
  hoursShort: boolean;
  jobs: number;
  bullets: number;
  eduMeta: boolean;
  edu: number;
  /** languages and skills in one row of pills */
  merge: boolean;
  targetLine: boolean;
  /** the summary's length, 0 for all of it */
  summary: number;
}
const DENSITY: Density[] = [
  { gap: 1, tight: false, licCols: 0, types: 4, typeMeta: true, hoursShort: false, jobs: 4, bullets: 2, edu: 3, eduMeta: true, merge: false, targetLine: true, summary: 0 },
  { gap: 0.92, tight: false, licCols: 2, types: 4, typeMeta: true, hoursShort: false, jobs: 4, bullets: 2, edu: 3, eduMeta: false, merge: false, targetLine: true, summary: 0 },
  { gap: 0.88, tight: false, licCols: 3, types: 3, typeMeta: true, hoursShort: false, jobs: 4, bullets: 1, edu: 3, eduMeta: false, merge: true, targetLine: true, summary: 0 },
  { gap: 0.85, tight: true, licCols: 3, types: 3, typeMeta: true, hoursShort: true, jobs: 4, bullets: 1, edu: 3, eduMeta: false, merge: true, targetLine: true, summary: 0 },
  { gap: 0.82, tight: true, licCols: 3, types: 3, typeMeta: false, hoursShort: true, jobs: 3, bullets: 1, edu: 2, eduMeta: false, merge: true, targetLine: false, summary: 420 },
  { gap: 0.75, tight: true, licCols: 3, types: 3, typeMeta: false, hoursShort: true, jobs: 3, bullets: 0, edu: 2, eduMeta: false, merge: true, targetLine: false, summary: 320 },
  { gap: 0.68, tight: true, licCols: 3, types: 3, typeMeta: false, hoursShort: true, jobs: 3, bullets: 0, edu: 2, eduMeta: false, merge: true, targetLine: false, summary: 220 },
];

function fit(doc: CvDocument, d: Density): CvDocument {
  const sections = doc.sections.map((s): Section => {
    const lines = s.lines;
    switch (s.id) {
      case "summary":
        // "matching the offer" (and, when space runs out, the target position) stay in the keywords; a long
        // summary keeps its first sentences
        return {
          ...s,
          lines: lines
            .filter((l) => !(l.kind === "pair" && (l.key === "match" || !d.targetLine)))
            .map((l) => (l.kind === "text" && d.summary ? { ...l, text: sentences(l.text, d.summary) } : l)),
        };
      case "hours": {
        const kept = d.hoursShort ? HOURS_SHORT : HOURS_KEPT;
        return { ...s, lines: lines.filter((l) => l.kind !== "pair" || !l.key || kept.includes(l.key)) };
      }
      case "types":
        return { ...s, lines: lines.slice(0, d.types).map((l) => (l.kind === "item" && !d.typeMeta ? { ...l, meta: undefined } : l)) };
      case "licences":
        return { ...s, lines: d.licCols ? lines.map((l) => (l.kind === "item" ? { ...l, meta: validity(l.meta) } : l)) : lines };
      case "experience":
        return { ...s, lines: lines.slice(0, d.jobs).map((l) => (l.kind === "item" ? { ...l, bullets: l.bullets?.slice(0, d.bullets) } : l)) };
      case "education":
        return { ...s, lines: lines.slice(0, d.edu).map((l) => (l.kind === "item" && !d.eduMeta ? { ...l, meta: undefined } : l)) };
      case "skills":
        return d.merge && doc.sections.some((x) => x.id === "languages") ? { ...s, lines: [] } : s;
      case "languages": {
        const skills = doc.sections.find((x) => x.id === "skills");
        if (!d.merge || !skills) return s;
        const few = skills.lines.map((l) => (l.kind === "text" ? { ...l, text: l.text.split(" · ").slice(0, 6).join(" · ") } : l));
        return { ...s, heading: `${s.heading} · ${skills.heading}`, lines: [...lines, ...few] };
      }
      default:
        return s;
    }
  });
  return { ...doc, sections: sections.filter((s) => s.id === "contact" || s.lines.length) };
}

/** the validity date, always last in a licence's details (authority and number left out) */
function validity(meta?: string): string | undefined {
  const last = meta?.split(" · ").at(-1);
  return last && /\d{4}/.test(last) ? last : undefined;
}

/** the first sentences of a text, within max characters (at least the first one) */
function sentences(s: string, max: number): string {
  const parts = s.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [s];
  let out = "";
  for (const p of parts) {
    if (out && (out + p).length > max) break;
    out += p;
  }
  return out.trim();
}

/** A one-page A4 CV: the first density level whose content fits on one page (the last one otherwise). */
export async function buildCvPdf(doc: CvDocument, opts: CvPdfOptions = {}): Promise<Uint8Array> {
  let out: { bytes: Uint8Array; pages: number } | undefined;
  for (const d of DENSITY) {
    out = await render(fit(doc, d), opts, d);
    if (out.pages <= 1) break;
  }
  return out!.bytes;
}

async function render(doc: CvDocument, opts: CvPdfOptions, d: Density): Promise<{ bytes: Uint8Array; pages: number }> {
  const g = d.gap;
  const pad = d.tight ? 10 : 0;
  const pdf = await PDFDocument.create();
  const th = CV_THEMES[opts.theme ?? "navy"];
  const DARK = hex(th.dark);
  const ACCENT = hex(th.accent);
  const TINT = hex(th.tint);

  let reg: PDFFont, semi: PDFFont, bold: PDFFont;
  // Chinese / Arabic: the script font of each weight
  const scriptOf = new Map<PDFFont, PDFFont>();
  let safe: (s: string) => string;
  if (opts.fonts) {
    pdf.registerFontkit(fontkit);
    reg = await pdf.embedFont(opts.fonts.regular, { subset: true });
    semi = await pdf.embedFont(opts.fonts.semibold, { subset: true });
    bold = await pdf.embedFont(opts.fonts.bold, { subset: true });
    if (opts.fonts.script) {
      scriptOf.set(reg, await pdf.embedFont(opts.fonts.script.regular, { subset: true }));
      scriptOf.set(semi, await pdf.embedFont(opts.fonts.script.semibold, { subset: true }));
      scriptOf.set(bold, await pdf.embedFont(opts.fonts.script.bold, { subset: true }));
    }
    // keep what the font can draw; typographic quotes and dashes are fine
    safe = (s) => s.replace(/[\u0000-\u001F\u200B-\u200F\uFEFF]/g, "").replace(/[\u202F\u2007\u2009]/g, "\u00A0");
  } else {
    reg = await pdf.embedFont(StandardFonts.Helvetica);
    semi = await pdf.embedFont(StandardFonts.HelveticaBold);
    bold = semi;
    safe = winAnsi;
  }

  pdf.setTitle(safe(`${doc.name} - CV`));
  pdf.setAuthor(safe(opts.author ?? doc.name));
  pdf.setSubject(safe(doc.headline));
  pdf.setKeywords(doc.keywords.map(safe));
  pdf.setCreator(safe(opts.author ?? doc.name));
  pdf.setProducer(safe(opts.author ?? doc.name));
  pdf.setLanguage(LANG_TAG[opts.lang ?? "en"]);

  const width = (s: string, f: PDFFont, size: number) => mixedWidth(safe(s), f, scriptOf.get(f), size);
  /** draws a line, switching to the script font for Chinese / Arabic runs */
  const draw = (p: PDFPage, s: string, x: number, yy: number, size: number, f: PDFFont, color: RGB) => {
    const sf = scriptOf.get(f);
    if (!sf || !hasScript(s)) return p.drawText(s, { x, y: yy, size, font: f, color });
    let cx = x;
    for (const r of runs(s)) {
      const font = r.script ? sf : f;
      p.drawText(r.text, { x: cx, y: yy, size, font, color });
      cx += font.widthOfTextAtSize(r.text, size);
    }
  };
  const wrap = (s: string, f: PDFFont, size: number, max: number): string[] => {
    const lines: string[] = [];
    let cur = "";
    for (const w of safe(s).split(/\s+/).filter(Boolean)) {
      const t = cur ? `${cur} ${w}` : w;
      if (mixedWidth(t, f, scriptOf.get(f), size) > max && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  let page: PDFPage = pdf.addPage([W, H]);
  /** cursor, measured from the top of the page */
  let y = 0;
  const Y = (top: number) => H - top;
  const text = (s: string, x: number, top: number, size: number, f: PDFFont, color: RGB = INK) =>
    draw(page, safe(s), x, Y(top), size, f, color);
  const rrect = (x: number, top: number, w: number, h: number, r: number, color: RGB) =>
    page.drawSvgPath(`M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`, {
      x,
      y: Y(top),
      color,
      borderWidth: 0,
    });
  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: DARK });
    y = M;
  };
  const need = (h: number) => {
    if (y + h > H - M - 14) newPage();
  };

  /* ---------- Header band ---------- */
  const contact = doc.sections.find((s) => s.id === "contact");
  const contactItems = (contact?.lines ?? []).flatMap((l) => (l.kind === "pair" ? [l.value] : []));
  const photo = opts.photo ? await embedPhoto(pdf, opts.photo) : null;
  const D = 84;
  const textMax = CW - (photo ? D + 20 : 0);
  const nameSize = width(doc.name, bold, 27) > textMax ? 22 : 27;
  const headLines = doc.headline ? wrap(doc.headline, reg, 11, textMax) : [];
  const contactLines: string[] = [];
  {
    let cur = "";
    for (const it of contactItems) {
      const t = cur ? `${cur}   ·   ${it}` : it;
      if (width(t, reg, 8.8) > textMax && cur) {
        contactLines.push(cur);
        cur = it;
      } else cur = t;
    }
    if (cur) contactLines.push(cur);
  }
  const bandH = Math.max(photo ? D + 44 - 2 * pad : 0, 46 - 2 * pad + nameSize + headLines.length * 15 + (contactLines.length ? 14 + contactLines.length * 13 : 0) + 18);
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: DARK });
  page.drawRectangle({ x: 0, y: H - bandH - 3, width: W, height: 3, color: ACCENT });
  y = 40 - pad + nameSize * 0.8;
  text(doc.name, M, y, nameSize, bold, WHITE);
  y += 8;
  for (const l of headLines) {
    y += 15;
    text(l, M, y, 11, reg, hex("#C9D3DF"));
  }
  if (contactLines.length) {
    y += 10;
    for (const l of contactLines) {
      y += 13;
      text(l, M, y, 8.8, reg, hex("#E8EDF3"));
    }
  }
  if (photo) {
    const cx = W - M - D / 2;
    const cy = H - bandH / 2;
    page.drawCircle({ x: cx, y: cy, size: D / 2 + 2.5, color: WHITE });
    const k = 0.5523 * (D / 2);
    const r = D / 2;
    page.pushOperators(
      pushGraphicsState(),
      moveTo(cx + r, cy),
      appendBezierCurve(cx + r, cy + k, cx + k, cy + r, cx, cy + r),
      appendBezierCurve(cx - k, cy + r, cx - r, cy + k, cx - r, cy),
      appendBezierCurve(cx - r, cy - k, cx - k, cy - r, cx, cy - r),
      appendBezierCurve(cx + k, cy - r, cx + r, cy - k, cx + r, cy),
      closePath(),
      clip(),
      endPath(),
    );
    // cover the circle: scale the shorter side to the diameter
    const s = D / Math.min(photo.width, photo.height);
    page.drawImage(photo, { x: cx - (photo.width * s) / 2, y: cy - (photo.height * s) / 2, width: photo.width * s, height: photo.height * s });
    page.pushOperators(popGraphicsState());
  }
  y = bandH + 3;

  /* ---------- Key figures ---------- */
  if (doc.figures.length) {
    y += 16 * g;
    const h = 54 - (d.tight ? 6 : 0);
    rrect(M, y, CW, h, 8, TINT);
    const cw = CW / doc.figures.length;
    doc.figures.forEach((f, i) => {
      const x = M + i * cw;
      if (i) page.drawLine({ start: { x, y: Y(y + 12) }, end: { x, y: Y(y + h - 12) }, thickness: 0.6, color: RULE });
      const vw = width(f.value, bold, 17);
      text(f.value, x + (cw - vw) / 2, y + h / 2 - 1, 17, bold, DARK);
      const lw = width(f.label.toUpperCase(), semi, 7);
      text(f.label.toUpperCase(), x + (cw - lw) / 2, y + h / 2 + 14, 7, semi, ACCENT);
    });
    y += h;
  }

  /* ---------- Sections ---------- */
  const heading = (s: Section) => {
    // keep the heading with the start of its section
    need(s.id === "experience" || s.id === "education" || s.id === "types" ? 96 : 64);
    y += 24 * g;
    page.drawRectangle({ x: M, y: Y(y) - 1, width: 3, height: 10, color: ACCENT });
    text(s.heading.toUpperCase(), M + 9, y, 9.5, bold, DARK);
    const hw = width(s.heading.toUpperCase(), bold, 9.5);
    page.drawLine({ start: { x: M + 9 + hw + 8, y: Y(y - 3.5) }, end: { x: W - M, y: Y(y - 3.5) }, thickness: 0.6, color: RULE });
    y += 6;
  };
  const para = (s: string, size: number, f: PDFFont, color: RGB, x: number, max: number, lead = 1.48) => {
    for (const l of wrap(s, f, size, max)) {
      need(size * lead);
      y += size * lead;
      text(l, x, y, size, f, color);
    }
  };
  const pills = (items: { a: string; b?: string }[]) => {
    let x = M;
    y += 8;
    const h = 18;
    let rowTop = y;
    for (const it of items) {
      const aw = width(it.a, semi, 8.6);
      const bw = it.b ? width(it.b, reg, 8.6) + 6 : 0;
      const w = aw + bw + 18;
      if (x + w > W - M) {
        x = M;
        rowTop += h + 6;
      }
      if (rowTop + h > H - M - 14) {
        newPage();
        rowTop = y;
        x = M;
      }
      rrect(x, rowTop, w, h, 9, TINT);
      text(it.a, x + 9, rowTop + 12.2, 8.6, semi, DARK);
      if (it.b) text(it.b, x + 9 + aw + 6, rowTop + 12.2, 8.6, reg, MUTED);
      x += w + 6;
    }
    y = rowTop + h;
  };

  for (const s of doc.sections) {
    if (s.id === "contact") continue;
    heading(s);
    const pairs = s.lines.filter((l): l is Extract<Line, { kind: "pair" }> => l.kind === "pair");
    const texts = s.lines.filter((l): l is Extract<Line, { kind: "text" }> => l.kind === "text");
    const items = s.lines.filter((l): l is Extract<Line, { kind: "item" }> => l.kind === "item");

    if (s.id === "hours") {
      // two columns of label / value, read left to right
      const gap = 26;
      const cw = (CW - gap) / 2;
      for (let i = 0; i < pairs.length; i += 2) {
        const rh = d.tight ? 15 : 17;
        need(rh);
        y += rh;
        [pairs[i], pairs[i + 1]].forEach((p, j) => {
          if (!p) return;
          const x = M + j * (cw + gap);
          text(p.label, x, y, 9, p.strong ? semi : reg, p.strong ? INK : MUTED);
          const vw = width(p.value, p.strong ? bold : semi, 9.2);
          text(p.value, x + cw - vw, y, 9.2, p.strong ? bold : semi, p.strong ? DARK : INK);
          page.drawLine({ start: { x, y: Y(y + 5.5) }, end: { x: x + cw, y: Y(y + 5.5) }, thickness: 0.4, color: RULE });
        });
      }
      for (const t of texts) {
        y += 4;
        para(t.text, 7.8, reg, MUTED, M, CW);
      }
      continue;
    }
    if (s.id === "summary") {
      for (const p of pairs) {
        need(16);
        y += 15;
        text(`${p.label} : `, M, y, 9.4, semi, ACCENT);
        text(p.value, M + width(`${p.label} : `, semi, 9.4), y, 9.4, semi, INK);
      }
      for (const t of texts) {
        y += 3;
        para(t.text, 9.8, reg, INK, M, CW);
      }
      continue;
    }
    if (s.id === "languages") {
      pills([
        ...pairs.map((p) => ({ a: p.label, b: p.value === "—" ? undefined : p.value })),
        ...texts.flatMap((t) => t.text.split(" · ")).filter(Boolean).map((a) => ({ a })),
      ]);
      continue;
    }
    if (s.id === "skills") {
      pills(texts.flatMap((t) => t.text.split(" · ")).filter(Boolean).map((a) => ({ a })));
      continue;
    }
    if (s.id === "types") {
      for (const [n, it] of items.entries()) {
        need(38);
        y += n ? (d.tight ? 19 : 22) : 17;
        text(it.title, M, y, 9.8, semi, INK);
        if (it.value) {
          const vw = width(it.value, bold, 9.8);
          text(it.value, W - M - vw, y, 9.8, bold, DARK);
        }
        y += 6;
        rrect(M, y, CW, 3.4, 1.7, TINT);
        if (it.ratio) rrect(M, y, Math.max(4, CW * Math.min(1, it.ratio)), 3.4, 1.7, ACCENT);
        y += 3.4;
        if (it.meta) {
          y += 10;
          // the total is already on the right: keep the details
          text(it.meta.split(" · ").slice(it.value ? 1 : 0).join("  ·  ") || it.meta, M, y, 7.8, reg, MUTED);
        }
      }
      continue;
    }
    if (s.id === "experience" || s.id === "education") {
      // timeline: dates in the gutter, a rule with a dot per entry, the entry on the right
      const gutter = 92;
      const lineX = M + gutter + 8;
      const x = lineX + 14;
      const max = W - M - x;
      for (const it of items) {
        need(40);
        const top = y + 8 * g;
        y = top;
        const whenLines = it.when ? wrap(it.when, semi, 8.2, gutter) : [];
        whenLines.forEach((l, i) => text(l, M, top + 11 + i * 11, 8.2, semi, ACCENT));
        para(it.title, 10, bold, INK, x, max, 1.35);
        if (it.meta) para(it.meta, 8.4, reg, MUTED, x, max, 1.45);
        for (const b of it.bullets ?? []) {
          const lines = wrap(b, reg, 9.2, max - 11);
          lines.forEach((l, i) => {
            need(13.4);
            y += 13.4;
            if (i === 0) page.drawCircle({ x: x + 2.5, y: Y(y - 3.1), size: 1.5, color: ACCENT });
            text(l, x + 11, y, 9.2, reg, INK);
          });
        }
        const bottom = Math.max(y, top + 11 + whenLines.length * 11) + 4 * g;
        page.drawLine({ start: { x: lineX, y: Y(top) }, end: { x: lineX, y: Y(bottom) }, thickness: 0.8, color: RULE });
        page.drawCircle({ x: lineX, y: Y(top + 7.5), size: 3.2, color: WHITE, borderColor: ACCENT, borderWidth: 1.6 });
        y = bottom;
      }
      continue;
    }
    // compact: one line per licence (code and validity), on two or three columns
    if (d.licCols && items.length && items.every((it) => it.short)) {
      const cols = d.licCols;
      const gap = 14;
      const cw = (CW - gap * (cols - 1)) / cols;
      y += 4;
      for (let i = 0; i < items.length; i += cols) {
        const row = items.slice(i, i + cols);
        const two = row.some((it) => it.meta && width(it.short!, semi, 9.2) + 6 + width(it.meta, reg, 8) > cw - 10);
        const h = two ? 26 : 16;
        need(h);
        row.forEach((it, j) => {
          const x = M + j * (cw + gap);
          page.drawRectangle({ x, y: Y(y + h - 2), width: 2, height: h - 5, color: ACCENT });
          text(it.short!, x + 9, y + 11, 9.2, semi, INK);
          if (it.meta) {
            if (two) text(it.meta, x + 9, y + 22, 8, reg, MUTED);
            else text(it.meta, x + 9 + width(it.short!, semi, 9.2) + 6, y + 11, 8, reg, MUTED);
          }
        });
        y += h;
      }
      continue;
    }
    // licences and anything else: entries on two columns, each with an accent mark
    const gap = 26;
    const cw = (CW - gap) / 2 - 10;
    for (let i = 0; i < items.length; i += 2) {
      const row = [items[i]!, items[i + 1]].filter((x): x is NonNullable<typeof x> => !!x);
      const blocks = row.map((it) => ({ title: wrap(it.title, semi, 9.4, cw), meta: it.meta ? wrap(it.meta, reg, 8.1, cw) : [] }));
      const h = Math.max(...blocks.map((b) => b.title.length * 12.5 + b.meta.length * 11.5)) + 8;
      need(h);
      const top = y + 6;
      blocks.forEach((b, j) => {
        const x = M + j * (cw + 10 + gap);
        page.drawRectangle({ x, y: Y(top + b.title.length * 12.5 + b.meta.length * 11.5) + 1, width: 2, height: b.title.length * 12.5 + b.meta.length * 11.5 - 1, color: ACCENT });
        let ty = top;
        for (const l of b.title) text(l, x + 10, (ty += 12.5) - 2.5, 9.4, semi, INK);
        for (const l of b.meta) text(l, x + 10, (ty += 11.5) - 2.5, 8.1, reg, MUTED);
      });
      y = top + h - 6;
    }
    for (const p of pairs) {
      need(15);
      y += 15;
      text(p.label, M, y, 9, reg, MUTED);
      text(p.value, M + 170, y, 9, semi, INK);
    }
    for (const t of texts) para(t.text, 9.4, reg, INK, M, CW);
  }

  /* ---------- Footer on every page ---------- */
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const left = safe(`${doc.name} — Curriculum vitae`);
    draw(p, left, M, 24, 7.2, reg, MUTED);
    const right = `${i + 1} / ${pages.length}`;
    p.drawText(right, { x: W - M - reg.widthOfTextAtSize(right, 7.2), y: 24, size: 7.2, font: reg, color: MUTED });
  });

  // Machine-readable copy for screening software: JSON Resume as an embedded file
  if (opts.jsonResume) {
    await pdf.attach(new TextEncoder().encode(JSON.stringify(opts.jsonResume, null, 2)), "resume.json", {
      mimeType: "application/json",
      description: "Structured CV (JSON Resume schema, with flight experience)",
      creationDate: new Date(),
      modificationDate: new Date(),
    });
  }
  pdf.catalog.set(PDFName.of("MarkInfo"), pdf.context.obj({ Marked: true }));
  pdf.catalog.set(PDFName.of("Lang"), PDFString.of(LANG_TAG[opts.lang ?? "en"]));
  return { bytes: await pdf.save(), pages: pages.length };
}

async function embedPhoto(pdf: PDFDocument, bytes: Uint8Array) {
  try {
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    return png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}
