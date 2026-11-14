import type { CvData, CvLicence, FlightExperience, TypeHours } from "./types";

/**
 * One neutral structure for every output (preview, plain text, PDF, JSON Resume).
 * Built for automated screening: single column, standard section names, plain text,
 * numbers written the same way everywhere, acronyms spelled out once.
 */

export type Line =
  | { kind: "pair"; label: string; value: string; strong?: boolean }
  | { kind: "item"; title: string; meta?: string; bullets?: string[] }
  | { kind: "text"; text: string };

export interface Section {
  id: "contact" | "summary" | "hours" | "types" | "licences" | "experience" | "education" | "languages" | "skills" | "additional";
  heading: string;
  lines: Line[];
}

export interface CvDocument {
  name: string;
  headline: string;
  sections: Section[];
  /** keywords an applicant-tracking system will look for, in priority order */
  keywords: string[];
}

const L = {
  en: {
    contact: "Contact", summary: "Professional Summary", hours: "Flight Experience", types: "Aircraft Types", licences: "Licences, Ratings & Medical",
    experience: "Professional Experience", education: "Education & Training", languages: "Languages", skills: "Skills", additional: "Additional Information",
    total: "Total flight time", pic: "Pilot in command (PIC)", picus: "PIC under supervision (PICUS)", copilot: "Co-pilot (SIC)", multiPilot: "Multi-pilot",
    multiEngine: "Multi-engine", seSingle: "Single-pilot single-engine", meSingle: "Single-pilot multi-engine", jet: "Jet", turboprop: "Turboprop",
    turbine: "Turbine (jet + turboprop)", piston: "Piston", helicopter: "Helicopter", night: "Night", ifr: "IFR", imc: "Actual IMC", fstd: "Simulator (FSTD)",
    instructor: "Instructor", dual: "Dual received", landings: "Landings", last12m: "Last 12 months", last90d: "Last 90 days", sectors: "Sectors flown",
    asOf: "Hours as of", lastFlight: "Last flight", validUntil: "valid until", noExpiry: "no expiry", present: "Present", email: "Email", phone: "Phone",
    location: "Location", nationality: "Nationality", dob: "Date of birth", linkedin: "LinkedIn", rightToWork: "Right to work", onType: "on type",
    asPic: "PIC", asCopilot: "SIC", lastFlown: "last flown", targetRole: "Target position", icao: "ICAO level", source: "Hours computed from an electronic logbook (Sillage).",
  },
  fr: {
    contact: "Contact", summary: "Profil", hours: "Expérience de vol", types: "Types d'avions", licences: "Licences, qualifications et aptitude médicale",
    experience: "Expérience professionnelle", education: "Formation", languages: "Langues", skills: "Compétences", additional: "Informations complémentaires",
    total: "Temps de vol total", pic: "Commandant de bord (PIC)", picus: "CDB sous supervision (PICUS)", copilot: "Copilote (SIC)", multiPilot: "Multipilote",
    multiEngine: "Multimoteur", seSingle: "Monopilote monomoteur", meSingle: "Monopilote multimoteur", jet: "Réacteur (jet)", turboprop: "Turbopropulseur",
    turbine: "Turbine (jet + turboprop)", piston: "Piston", helicopter: "Hélicoptère", night: "Nuit", ifr: "IFR", imc: "IMC réel", fstd: "Simulateur (FSTD)",
    instructor: "Instructeur", dual: "Double commande", landings: "Atterrissages", last12m: "12 derniers mois", last90d: "90 derniers jours", sectors: "Étapes",
    asOf: "Heures arrêtées au", lastFlight: "Dernier vol", validUntil: "valide jusqu'au", noExpiry: "sans échéance", present: "Aujourd'hui", email: "E-mail",
    phone: "Téléphone", location: "Lieu", nationality: "Nationalité", dob: "Date de naissance", linkedin: "LinkedIn", rightToWork: "Autorisation de travail",
    onType: "sur type", asPic: "CDB", asCopilot: "OPL", lastFlown: "dernier vol", targetRole: "Poste visé", icao: "niveau OACI",
    source: "Heures calculées à partir d'un carnet de vol électronique (Sillage).",
  },
};

const LICENCE_NAMES: Record<string, string> = {
  ATPL: "Airline Transport Pilot Licence (ATPL)", CPL: "Commercial Pilot Licence (CPL)", MPL: "Multi-crew Pilot Licence (MPL)", PPL: "Private Pilot Licence (PPL)",
  LAPL: "Light Aircraft Pilot Licence (LAPL)", IR: "Instrument Rating (IR)", MEP: "Multi-Engine Piston (MEP)", SEP: "Single-Engine Piston (SEP)",
  FI: "Flight Instructor (FI)", TRI: "Type Rating Instructor (TRI)", TRE: "Type Rating Examiner (TRE)", MCC: "Multi-Crew Cooperation (MCC)", JOC: "Jet Orientation Course (JOC)",
  CRI: "Class Rating Instructor (CRI)", IRI: "Instrument Rating Instructor (IRI)", UPRT: "Upset Prevention and Recovery Training (UPRT)",
};

/** "ATPL(A)" → "Airline Transport Pilot Licence (ATPL) — Aeroplane" : the long form is what screening tools match on. */
export function expandLicence(code: string): string {
  const m = code.match(/^([A-Z]+)/);
  const base = m ? LICENCE_NAMES[m[1]!] : undefined;
  if (!base) return code;
  const rest = code.slice(m![1]!.length).trim();
  const cat = /\(A\)/.test(rest) ? " (Aeroplane)" : /\(H\)/.test(rest) ? " (Helicopter)" : "";
  const tail = rest.replace(/\((A|H)\)/, "").trim();
  return `${base}${cat}${tail ? ` ${tail}` : ""}`;
}

const fmtH = (min: number, locale: "en" | "fr") => `${new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB").format(Math.round(min / 60))} h`;
const month = (ym: string | undefined, locale: "en" | "fr") => {
  if (!ym) return "";
  const d = new Date(`${ym.slice(0, 7)}-01T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? ym : new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
};
const day = (iso: string | undefined | null, locale: "en" | "fr") =>
  iso ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)) : "";

/** Types relevant to the target job first, then by hours. */
export function orderTypes(types: TypeHours[], target?: string[]): TypeHours[] {
  if (!target?.length) return types;
  return [...types].sort((a, b) => Number(target.includes(b.icao)) - Number(target.includes(a.icao)) || b.totalMin - a.totalMin);
}

function hourLines(h: FlightExperience, t: (typeof L)["en"], locale: "en" | "fr"): Line[] {
  const rows: [string, number, boolean?][] = [
    [t.total, h.totalMin, true], [t.pic, h.picMin, true], [t.picus, h.picusMin], [t.copilot, h.copilotMin], [t.multiPilot, h.multiPilotMin, true],
    [t.multiEngine, h.multiEngineMin], [t.turbine, h.turbineMin, true], [t.jet, h.jetMin], [t.turboprop, h.turbopropMin], [t.piston, h.pistonMin],
    [t.helicopter, h.helicopterMin], [t.seSingle, h.singlePilotSeMin], [t.meSingle, h.singlePilotMeMin], [t.night, h.nightMin], [t.ifr, h.ifrMin],
    [t.imc, h.actualImcMin], [t.instructor, h.instructorMin], [t.fstd, h.fstdMin], [t.last12m, h.last12mMin], [t.last90d, h.last90dMin],
  ];
  const lines: Line[] = rows.filter(([, v], i) => i === 0 || v > 0).map(([label, v, strong]) => ({ kind: "pair" as const, label, value: fmtH(v, locale), strong }));
  if (h.landings) lines.push({ kind: "pair", label: t.landings, value: new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB").format(h.landings) });
  lines.push({ kind: "text", text: `${t.asOf} ${day(h.asOf, locale)}${h.lastFlight ? ` · ${t.lastFlight} ${day(h.lastFlight, locale)}` : ""}. ${t.source}` });
  return lines;
}

function licenceLine(l: CvLicence, t: (typeof L)["en"], locale: "en" | "fr"): Line {
  const name = l.kind === "licence" || l.kind === "rating" ? expandLicence(l.code) : l.code;
  const meta = [l.authority, l.number, l.validUntil ? `${t.validUntil} ${day(l.validUntil, locale)}` : l.kind === "medical" ? "" : t.noExpiry].filter(Boolean).join(" · ");
  return { kind: "item", title: name, meta };
}

export function buildCvDocument(cv: CvData): CvDocument {
  const { profile: p, hours: h, locale } = cv;
  const t = L[locale];
  const sections: Section[] = [];
  const types = orderTypes(h.byType, p.target?.aircraft);

  const contact: Line[] = [];
  if (p.email) contact.push({ kind: "pair", label: t.email, value: p.email });
  if (p.phone) contact.push({ kind: "pair", label: t.phone, value: p.phone });
  if (p.location) contact.push({ kind: "pair", label: t.location, value: p.location });
  if (p.nationality) contact.push({ kind: "pair", label: t.nationality, value: p.nationality });
  if (p.dateOfBirth) contact.push({ kind: "pair", label: t.dob, value: day(p.dateOfBirth, locale) });
  if (p.linkedin) contact.push({ kind: "pair", label: t.linkedin, value: p.linkedin });
  if (p.rightToWork) contact.push({ kind: "pair", label: t.rightToWork, value: p.rightToWork });
  if (contact.length) sections.push({ id: "contact", heading: t.contact, lines: contact });

  const summary: Line[] = [];
  if (p.target?.title) summary.push({ kind: "pair", label: t.targetRole, value: [p.target.title, p.target.company].filter(Boolean).join(" — ") });
  if (p.summary?.trim()) summary.push({ kind: "text", text: p.summary.trim() });
  if (summary.length) sections.push({ id: "summary", heading: t.summary, lines: summary });

  sections.push({ id: "hours", heading: t.hours, lines: hourLines(h, t, locale) });

  if (types.length) {
    sections.push({
      id: "types",
      heading: t.types,
      lines: types.slice(0, 12).map((x) => ({
        kind: "item" as const,
        title: `${x.name} (${x.icao})`,
        meta: [`${fmtH(x.totalMin, locale)} ${t.onType}`, x.picMin ? `${fmtH(x.picMin, locale)} ${t.asPic}` : "", x.copilotMin ? `${fmtH(x.copilotMin, locale)} ${t.asCopilot}` : "", x.lastFlown ? `${t.lastFlown} ${month(x.lastFlown, locale)}` : ""]
          .filter(Boolean)
          .join(" · "),
      })),
    });
  }

  const order = ["licence", "rating", "medical", "endorsement", "language", "other"];
  const lic = [...cv.licences].filter((l) => l.kind !== "language" && !/passport|passeport|badge/i.test(l.code)).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  if (lic.length) sections.push({ id: "licences", heading: t.licences, lines: lic.map((l) => licenceLine(l, t, locale)) });

  if (p.experience.length) {
    sections.push({
      id: "experience",
      heading: t.experience,
      lines: [...p.experience]
        .sort((a, b) => (b.end ?? "9999").localeCompare(a.end ?? "9999") || b.start.localeCompare(a.start))
        .map((x) => ({
          kind: "item" as const,
          title: `${x.role} — ${x.employer}`,
          meta: [`${month(x.start, locale)} – ${x.end ? month(x.end, locale) : t.present}`, x.location, x.aircraft?.length ? x.aircraft.join(", ") : ""].filter(Boolean).join(" · "),
          bullets: x.bullets.filter((b) => b.trim()),
        })),
    });
  }

  if (p.education.length) {
    sections.push({
      id: "education",
      heading: t.education,
      lines: p.education.map((x) => ({ kind: "item" as const, title: `${x.title} — ${x.school}`, meta: [x.start || x.end ? `${month(x.start, locale)}${x.end ? ` – ${month(x.end, locale)}` : ""}` : "", x.details].filter(Boolean).join(" · ") })),
    });
  }

  const langs: Line[] = p.languages.map((x) => ({ kind: "pair" as const, label: x.name, value: [x.icaoLevel ? `${t.icao} ${x.icaoLevel}` : "", x.level].filter(Boolean).join(" · ") || "—" }));
  for (const l of cv.licences.filter((x) => x.kind === "language")) {
    const lvl = l.code.match(/([4-6])/)?.[1];
    const name = l.code.replace(/^LPE\s*/i, "").replace(/\s*\d.*$/, "").trim() || l.code;
    if (!langs.some((x) => x.kind === "pair" && x.label.toLowerCase() === name.toLowerCase())) langs.push({ kind: "pair", label: name, value: lvl ? `${t.icao} ${lvl}` : l.code });
  }
  if (langs.length) sections.push({ id: "languages", heading: t.languages, lines: langs });

  if (p.skills.length) sections.push({ id: "skills", heading: t.skills, lines: [{ kind: "text", text: p.skills.join(" · ") }] });

  // Keywords screening tools match on: licence names, types (ICAO + marketing name), hour categories, target keywords
  const kw = new Set<string>();
  for (const l of lic) {
    kw.add(l.code);
    const long = expandLicence(l.code);
    if (long !== l.code) kw.add(long.replace(/ \(.*$/, ""));
  }
  for (const x of types.slice(0, 6)) {
    kw.add(x.icao);
    kw.add(x.name);
  }
  if (h.multiPilotMin) kw.add("Multi-crew");
  if (h.jetMin) kw.add("Jet");
  if (h.turbineMin) kw.add("Turbine");
  for (const k of p.target?.keywords ?? []) kw.add(k);

  const headline = p.headline?.trim() || [p.target?.title, types[0] ? `${fmtH(h.totalMin, locale)} TT · ${types[0].name}` : `${fmtH(h.totalMin, locale)} TT`].filter(Boolean).join(" · ");
  return { name: p.fullName.trim() || "—", headline, sections, keywords: [...kw] };
}

/** Plain text version (what a parser "sees"); also good for pasting into application forms. */
export function cvToText(doc: CvDocument): string {
  const out: string[] = [doc.name.toUpperCase(), doc.headline, ""];
  for (const s of doc.sections) {
    out.push(s.heading.toUpperCase());
    for (const l of s.lines) {
      if (l.kind === "pair") out.push(`${l.label}: ${l.value}`);
      else if (l.kind === "text") out.push(l.text);
      else {
        out.push(l.title + (l.meta ? ` | ${l.meta}` : ""));
        for (const b of l.bullets ?? []) out.push(`- ${b}`);
      }
    }
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}
