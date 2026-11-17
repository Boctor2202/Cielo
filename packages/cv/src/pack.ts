import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CV_THEMES, type CvFonts } from "./pdf";
import type { CvLicence, CvTheme, FlightExperience } from "./types";

/**
 * Application pack: what an airline recruiter asks for, in one PDF. The pilot's CV, then a flight-hours
 * statement taken from the logbook (totals by function and category, by type, recent activity), the list of
 * licences, ratings and medical with their validity, a declaration to sign, and the scans of the documents
 * the pilot attached (images and PDFs).
 */

export interface PackDocument extends CvLicence {
  /** data URL of the scan stored with the document (image or PDF) */
  attachmentDataUrl?: string;
}

export interface PackOptions {
  /** the CV, already rendered (buildCvPdf) */
  cvPdf: Uint8Array;
  hours: FlightExperience;
  documents: PackDocument[];
  pilotName: string;
  licenceNumber?: string;
  locale: "en" | "fr";
  theme?: CvTheme;
  fonts?: CvFonts;
  /** date shown on the statement (YYYY-MM-DD) */
  today: string;
}

const W = 595.28;
const H = 841.89;
const M = 48;

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex("#16202C");
const MUTED = hex("#5B6878");
const RULE = hex("#DCE2E9");

const L = {
  en: {
    statement: "Flight experience statement",
    from: "Totals taken from the pilot's logbook, including hours carried forward from previous logbooks.",
    asOf: "As of",
    name: "Pilot",
    licence: "Licence no.",
    totals: "Totals",
    byType: "By type",
    recent: "Recent activity",
    type: "Type",
    total: "Total",
    pic: "PIC",
    copilot: "Co-pilot",
    lastFlown: "Last flown",
    rows: {
      total: "Total flight time", pic: "Pilot in command", picus: "PIC under supervision", copilot: "Co-pilot", dual: "Dual instruction received",
      instructor: "Instructor", multiPilot: "Multi-pilot", multiEngine: "Multi-engine", jet: "Jet", turboprop: "Turboprop", night: "Night",
      ifr: "IFR", imc: "Actual IMC", fstd: "Flight simulator (FSTD)", landings: "Landings", sectors: "Sectors",
      last12: "Last 12 months", last90: "Last 90 days", lastFlight: "Last flight",
    },
    docs: "Licences, ratings and medical",
    doc: "Document",
    authority: "Authority",
    number: "Number",
    validUntil: "Valid until",
    noExpiry: "no expiry",
    declaration: "I certify that the information above is true and taken from my logbook.",
    date: "Date",
    signature: "Signature",
    scans: "Copies of documents",
    hours: "h",
  },
  fr: {
    statement: "Relevé d'expérience aéronautique",
    from: "Totaux extraits du carnet de vol du pilote, heures reportées des carnets précédents comprises.",
    asOf: "Au",
    name: "Pilote",
    licence: "N° de licence",
    totals: "Totaux",
    byType: "Par type",
    recent: "Activité récente",
    type: "Type",
    total: "Total",
    pic: "CDB",
    copilot: "Copilote",
    lastFlown: "Dernier vol",
    rows: {
      total: "Temps de vol total", pic: "Commandant de bord", picus: "CDB sous supervision", copilot: "Copilote", dual: "Double commande reçue",
      instructor: "Instructeur", multiPilot: "Multipilote", multiEngine: "Multimoteur", jet: "Réacteur", turboprop: "Turbopropulseur", night: "Nuit",
      ifr: "IFR", imc: "IMC réel", fstd: "Simulateur (FSTD)", landings: "Atterrissages", sectors: "Étapes",
      last12: "12 derniers mois", last90: "90 derniers jours", lastFlight: "Dernier vol",
    },
    docs: "Licences, qualifications et aptitude médicale",
    doc: "Document",
    authority: "Autorité",
    number: "Numéro",
    validUntil: "Valide jusqu'au",
    noExpiry: "sans échéance",
    declaration: "Je certifie que les informations ci-dessus sont exactes et extraites de mon carnet de vol.",
    date: "Date",
    signature: "Signature",
    scans: "Copies des documents",
    hours: "h",
  },
};

const hhmm = (m: number) => `${Math.floor(m / 60).toLocaleString("en-US")}:${String(Math.round(m) % 60).padStart(2, "0")}`;
const fmtDate = (d: string | null | undefined, locale: "en" | "fr") => {
  if (!d) return "";
  const [y, mo, da] = d.slice(0, 10).split("-");
  return locale === "fr" ? `${da}/${mo}/${y}` : `${y}-${mo}-${da}`;
};

function dataUrlBytes(url: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!m || !m[2]) return null;
  // atob exists in browsers, Hermes and Node 16+
  const bin = atob(m[3]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1]!, bytes };
}

export async function buildApplicationPack(o: PackOptions): Promise<Uint8Array> {
  const t = L[o.locale];
  const pdf = await PDFDocument.create();
  const ACCENT = hex(CV_THEMES[o.theme ?? "navy"].accent);
  const DARK = hex(CV_THEMES[o.theme ?? "navy"].dark);

  let reg: PDFFont;
  let bold: PDFFont;
  let safe = (s: string) => s;
  if (o.fonts) {
    pdf.registerFontkit(fontkit);
    reg = await pdf.embedFont(o.fonts.regular, { subset: true });
    bold = await pdf.embedFont(o.fonts.bold, { subset: true });
  } else {
    reg = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    safe = (s) => s.replace(/[–—−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
  }

  // 1. the CV
  const cv = await PDFDocument.load(o.cvPdf);
  for (const p of await pdf.copyPages(cv, cv.getPageIndices())) pdf.addPage(p);

  // 2. statement of experience and documents
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, size = 10, f = reg, color = INK) => page.drawText(safe(s), { x, y, size, font: f, color });
  const right = (s: string, xRight: number, size = 10, f = reg, color = INK) =>
    page.drawText(safe(s), { x: xRight - f.widthOfTextAtSize(safe(s), size), y, size, font: f, color });
  const rule = (gap = 6) => {
    page.drawLine({ start: { x: M, y: y + gap }, end: { x: W - M, y: y + gap }, thickness: 0.6, color: RULE });
  };
  const ensure = (need: number) => {
    if (y - need > M + 30) return;
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const heading = (s: string) => {
    ensure(60);
    y -= 14;
    text(s.toUpperCase(), M, 9.5, bold, ACCENT);
    y -= 8;
    rule(4);
    y -= 10;
  };

  text(t.statement, M, 20, bold, DARK);
  y -= 18;
  text(t.from, M, 9, reg, MUTED);
  y -= 22;
  text(`${t.name}${o.locale === "fr" ? " : " : ": "}${o.pilotName}`, M, 10.5, bold);
  right(`${t.asOf} ${fmtDate(o.today, o.locale)}`, W - M, 10.5, bold);
  if (o.licenceNumber) {
    y -= 14;
    text(`${t.licence} ${o.licenceNumber}`, M, 9.5, reg, MUTED);
  }
  y -= 10;

  const h = o.hours;
  const rows: [string, string][] = [
    [t.rows.total, hhmm(h.totalMin)],
    [t.rows.pic, hhmm(h.picMin)],
    [t.rows.picus, hhmm(h.picusMin)],
    [t.rows.copilot, hhmm(h.copilotMin)],
    [t.rows.dual, hhmm(h.dualMin)],
    [t.rows.instructor, hhmm(h.instructorMin)],
    [t.rows.multiPilot, hhmm(h.multiPilotMin)],
    [t.rows.multiEngine, hhmm(h.multiEngineMin)],
    [t.rows.jet, hhmm(h.jetMin)],
    [t.rows.turboprop, hhmm(h.turbopropMin)],
    [t.rows.night, hhmm(h.nightMin)],
    [t.rows.ifr, hhmm(h.ifrMin)],
    [t.rows.imc, hhmm(h.actualImcMin)],
    [t.rows.fstd, hhmm(h.fstdMin)],
    [t.rows.landings, String(h.landings)],
    [t.rows.sectors, String(h.sectors)],
  ].filter(([k, v], i) => i === 0 || (v !== "0:00" && v !== "0")) as [string, string][];
  heading(t.totals);
  // two columns
  const half = Math.ceil(rows.length / 2);
  const colW = (W - 2 * M - 24) / 2;
  const top = y;
  rows.forEach(([k, v], i) => {
    const col = i < half ? 0 : 1;
    const row = col ? i - half : i;
    y = top - row * 17;
    const x0 = M + col * (colW + 24);
    text(k, x0, 10, i === 0 ? bold : reg);
    right(v, x0 + colW, 10, bold);
  });
  y = top - half * 17 - 4;

  heading(t.recent);
  const recent: [string, string][] = [
    [t.rows.last12, `${hhmm(h.last12mMin)} ${t.hours}`],
    [t.rows.last90, `${hhmm(h.last90dMin)} ${t.hours}`],
    [t.rows.lastFlight, fmtDate(h.lastFlight, o.locale) || "-"],
  ];
  for (const [k, v] of recent) {
    text(k, M, 10);
    right(v, M + colW, 10, bold);
    y -= 17;
  }

  if (h.byType.length) {
    heading(t.byType);
    const cols = [M, M + 210, M + 290, M + 370, W - M];
    text(t.type, cols[0]!, 8.5, bold, MUTED);
    right(t.total, cols[1]! + 60, 8.5, bold, MUTED);
    right(t.pic, cols[2]! + 60, 8.5, bold, MUTED);
    right(t.copilot, cols[3]! + 60, 8.5, bold, MUTED);
    right(t.lastFlown, cols[4]!, 8.5, bold, MUTED);
    y -= 15;
    for (const ty of h.byType) {
      ensure(18);
      const label = ty.name && ty.name !== ty.icao ? `${ty.icao} · ${ty.name}` : ty.icao;
      text(label.length > 38 ? `${label.slice(0, 37)}…` : label, cols[0]!, 9.5);
      right(hhmm(ty.totalMin), cols[1]! + 60, 9.5, bold);
      right(hhmm(ty.picMin), cols[2]! + 60, 9.5);
      right(hhmm(ty.copilotMin), cols[3]! + 60, 9.5);
      right(fmtDate(ty.lastFlown, o.locale), cols[4]!, 9.5, reg, MUTED);
      y -= 15;
    }
  }

  const docs = o.documents.filter((d) => d.code);
  if (docs.length) {
    heading(t.docs);
    const cols = [M, M + 200, M + 300, W - M];
    text(t.doc, cols[0]!, 8.5, bold, MUTED);
    text(t.authority, cols[1]!, 8.5, bold, MUTED);
    text(t.number, cols[2]!, 8.5, bold, MUTED);
    right(t.validUntil, cols[3]!, 8.5, bold, MUTED);
    y -= 15;
    for (const d of docs) {
      ensure(18);
      text(d.code.length > 34 ? `${d.code.slice(0, 33)}…` : d.code, cols[0]!, 9.5, bold);
      text(d.authority ?? "", cols[1]!, 9.5, reg, MUTED);
      text(d.number ?? "", cols[2]!, 9.5, reg, MUTED);
      right(d.validUntil ? fmtDate(d.validUntil, o.locale) : t.noExpiry, cols[3]!, 9.5);
      y -= 15;
    }
  }

  // declaration
  ensure(110);
  y -= 22;
  text(t.declaration, M, 10);
  y -= 46;
  page.drawLine({ start: { x: M, y }, end: { x: M + 180, y }, thickness: 0.6, color: MUTED });
  page.drawLine({ start: { x: W - M - 220, y }, end: { x: W - M, y }, thickness: 0.6, color: MUTED });
  y -= 12;
  text(`${t.date}${o.locale === "fr" ? " : " : ": "}${fmtDate(o.today, o.locale)}`, M, 9, reg, MUTED);
  text(t.signature, W - M - 220, 9, reg, MUTED);

  // 3. scans of the documents
  let titled = false;
  for (const d of o.documents) {
    const f = d.attachmentDataUrl ? dataUrlBytes(d.attachmentDataUrl) : null;
    if (!f) continue;
    try {
      if (f.mime === "application/pdf") {
        const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
        for (const p of await pdf.copyPages(src, src.getPageIndices())) pdf.addPage(p);
        continue;
      }
      const img = f.mime === "image/png" ? await pdf.embedPng(f.bytes) : f.mime === "image/jpeg" || f.mime === "image/jpg" ? await pdf.embedJpg(f.bytes) : null;
      if (!img) continue;
      page = pdf.addPage([W, H]);
      y = H - M;
      if (!titled) {
        text(t.scans.toUpperCase(), M, 9.5, bold, ACCENT);
        titled = true;
        y -= 18;
      }
      text(d.code, M, 12, bold, DARK);
      y -= 14;
      const maxW = W - 2 * M;
      const maxH = y - M;
      const s = Math.min(maxW / img.width, maxH / img.height, 1.5);
      page.drawImage(img, { x: M + (maxW - img.width * s) / 2, y: y - img.height * s, width: img.width * s, height: img.height * s });
    } catch {
      // an unreadable scan is skipped; the list above still names the document
    }
  }

  pdf.setTitle(`${o.pilotName} — ${t.statement}`);
  pdf.setAuthor(o.pilotName);
  return pdf.save();
}
