/** What the pilot types in (everything else comes from the logbook and licences). */
export interface CvProfile {
  fullName: string;
  /** e.g. "First Officer – Cessna Citation Latitude" */
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  nationality?: string;
  dateOfBirth?: string;
  linkedin?: string;
  /** 2–4 sentences */
  summary?: string;
  /** target job, used to tailor the order of types and keywords */
  target?: { title: string; company?: string; aircraft?: string[]; keywords?: string[] };
  experience: CvExperience[];
  education: { title: string; school: string; start?: string; end?: string; details?: string }[];
  languages: { name: string; icaoLevel?: number; level?: string }[];
  skills: string[];
  /** right to work, e.g. "EU passport", "Valid US visa" */
  rightToWork?: string;
  /** colour theme of the PDF */
  theme?: CvTheme;
  /** show the profile photo in the header */
  photo?: boolean;
}

export interface CvExperience {
  role: string;
  employer: string;
  location?: string;
  start: string; // YYYY-MM
  end?: string; // YYYY-MM, empty = present
  aircraft?: string[]; // ICAO designators
  bullets: string[];
}

export interface TypeHours {
  icao: string;
  name: string;
  category: string;
  engineType: string;
  multiPilot: boolean;
  totalMin: number;
  picMin: number;
  copilotMin: number;
  lastFlown?: string;
}

/** Hours by category, all in minutes, computed from the logbook (+ carried-forward paper totals). */
export interface FlightExperience {
  asOf: string;
  totalMin: number;
  picMin: number;
  picusMin: number;
  copilotMin: number;
  dualMin: number;
  instructorMin: number;
  multiPilotMin: number;
  singlePilotSeMin: number;
  singlePilotMeMin: number;
  multiEngineMin: number;
  jetMin: number;
  turbopropMin: number;
  turbineMin: number;
  pistonMin: number;
  helicopterMin: number;
  nightMin: number;
  ifrMin: number;
  actualImcMin: number;
  fstdMin: number;
  landings: number;
  last12mMin: number;
  last90dMin: number;
  sectors: number;
  byType: TypeHours[];
  lastFlight?: string;
}

export interface CvLicence {
  kind: string;
  code: string;
  authority?: string;
  number?: string;
  validUntil?: string | null;
  issuedOn?: string | null;
}

export interface CvData {
  profile: CvProfile;
  hours: FlightExperience;
  licences: CvLicence[];
  locale: CvLocale;
}

/** The CV languages: the six official languages of ICAO. */
export type CvLocale = "en" | "fr" | "es" | "ru" | "zh" | "ar";
export const CV_LOCALES: CvLocale[] = ["en", "fr", "es", "ru", "zh", "ar"];
/** BCP 47 tag of each CV language (PDF metadata, dates and numbers). */
export const LANG_TAG: Record<CvLocale, string> = { en: "en-GB", fr: "fr-FR", es: "es-ES", ru: "ru-RU", zh: "zh-CN", ar: "ar" };
/** The second font a CV language needs beside Inter. */
export const SCRIPT_FONT: Partial<Record<CvLocale, "sc" | "arabic">> = { zh: "sc", ar: "arabic" };

export type CvTheme = "navy" | "burgundy" | "forest" | "graphite";
