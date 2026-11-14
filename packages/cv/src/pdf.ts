import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { CvDocument } from "./document";

/**
 * A4, single column, real text (selectable, in reading order), standard fonts, no tables or images:
 * the layout CV-screening software and AI readers parse most reliably.
 * The structured JSON Resume is attached inside the PDF and the keywords go in the metadata.
 */

const W = 595.28;
const H = 841.89;
const M = 54;
const INK = rgb(0.06, 0.09, 0.15);
const MUTED = rgb(0.32, 0.38, 0.46);
const ACCENT = rgb(0.055, 0.455, 0.565);

/** Standard PDF fonts are WinAnsi: map typographic characters, drop the rest. */
function safe(s: string): string {
  return s
    .replace(/[–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface CvPdfOptions {
  jsonResume?: unknown;
  author?: string;
  lang?: "en" | "fr";
}

export async function buildCvPdf(doc: CvDocument, opts: CvPdfOptions = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(safe(`${doc.name} - CV`));
  pdf.setAuthor(safe(opts.author ?? doc.name));
  pdf.setSubject(safe(doc.headline));
  pdf.setKeywords(doc.keywords.map(safe));
  pdf.setCreator("Cielo");
  pdf.setProducer("Cielo");
  pdf.setLanguage(opts.lang === "fr" ? "fr-FR" : "en-GB");

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const need = (h: number) => {
    if (y - h < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const text = (s: string, x: number, size: number, f: PDFFont, color = INK) => page.drawText(safe(s), { x, y, size, font: f, color });
  const para = (s: string, size: number, f: PDFFont, color = INK, indent = 0, lead = 1.35) => {
    for (const line of wrap(s, f, size, W - 2 * M - indent)) {
      need(size * lead);
      y -= size * lead;
      text(line, M + indent, size, f, color);
    }
  };

  // Header: name + headline, as plain text at the top of page 1 (not in a PDF header area)
  y -= 22;
  text(doc.name, M, 22, bold);
  if (doc.headline) {
    y -= 6;
    para(doc.headline, 11, font, MUTED);
  }

  for (const s of doc.sections) {
    need(40);
    y -= 22;
    text(s.heading.toUpperCase(), M, 10.5, bold, ACCENT);
    y -= 5;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.8, 0.84, 0.88) });
    y -= 2;
    for (const l of s.lines) {
      if (l.kind === "pair") {
        need(15);
        y -= 14.5;
        const label = `${l.label}:`;
        text(label, M, 10, l.strong ? bold : font, l.strong ? INK : MUTED);
        text(l.value, M + Math.max(190, font.widthOfTextAtSize(safe(label), 10) + 10), 10, l.strong ? bold : font);
      } else if (l.kind === "text") {
        y -= 3;
        para(l.text, 10, font);
      } else {
        y -= 4;
        para(l.title, 10.5, bold);
        if (l.meta) para(l.meta, 9.5, font, MUTED);
        for (const b of l.bullets ?? []) {
          const lines = wrap(b, font, 10, W - 2 * M - 14);
          lines.forEach((ln, i) => {
            need(13.5);
            y -= 13.5;
            if (i === 0) text("-", M + 2, 10, font, MUTED);
            text(ln, M + 14, 10, font);
          });
        }
      }
    }
  }

  // Machine-readable copy for screening software: JSON Resume as an embedded file
  if (opts.jsonResume) {
    await pdf.attach(new TextEncoder().encode(JSON.stringify(opts.jsonResume, null, 2)), "resume.json", {
      mimeType: "application/json",
      description: "Structured CV (JSON Resume schema, with flight experience)",
      creationDate: new Date(),
      modificationDate: new Date(),
    });
  }
  // Mark the document as tagged text for accessibility-aware readers
  pdf.catalog.set(PDFName.of("MarkInfo"), pdf.context.obj({ Marked: true }));
  pdf.catalog.set(PDFName.of("Lang"), PDFString.of(opts.lang === "fr" ? "fr-FR" : "en-GB"));
  return pdf.save();
}
