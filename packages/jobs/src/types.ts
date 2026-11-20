/**
 * A pilot job offer as Geardown stores and shows it: facts extracted from the employer's own public job feed,
 * plus a link to the original posting. The posting text itself is never stored or republished.
 */

import type { Authority, RegionId } from "./regions";

export type Ats = "greenhouse" | "lever" | "personio" | "recruitee" | "teamtailor" | "workable" | "ashby" | "smartrecruiters" | "successfactors" | "adzuna";

export interface Source {
  /** Employer name as displayed */
  company: string;
  ats: Ats;
  /** Board token / subdomain on the ATS */
  token: string;
  /** Default country (ISO 3166-1 alpha-2) when the feed has none */
  country?: string;
  segment: "airline" | "business" | "cargo" | "regional" | "helicopter" | "training" | "other";
}

/** What a fetcher returns: transient, used only for extraction. */
export interface RawPosting {
  id: string;
  company: string;
  title: string;
  url: string;
  location?: string;
  country?: string;
  postedAt?: string;
  employment?: string;
  /** Plain text of the posting, used for extraction then dropped */
  text: string;
  salary?: { min?: number; max?: number; currency?: string; period?: string };
}

export type Position = "CPT" | "FO" | "SO" | "CADET" | "FI" | "OTHER";
export type LicenceLevel = "ATPL" | "FATPL" | "MPL" | "CPL" | "PPL";

export interface Requirements {
  licence?: LicenceLevel;
  /** EASA / FAA / … when stated */
  authority?: string;
  totalHours?: number;
  picHours?: number;
  onTypeHours?: number;
  multiPilotHours?: number;
  turbineHours?: number;
  jetHours?: number;
  /** A type rating on the job's aircraft is required (not provided by the employer) */
  typeRatingRequired?: boolean;
  /** The employer provides / sponsors the type rating */
  typeRatingProvided?: boolean;
  /** ICAO language proficiency level */
  englishLevel?: number;
  /** The employer sponsors the visa / work permit */
  visaSponsored?: boolean;
  /** The ad says applicants must already have the right to work there */
  rightToWorkRequired?: boolean;
}

export interface Salary {
  min?: number;
  max?: number;
  currency: string;
  period: "year" | "month" | "day" | "hour";
  /** Indicative annual amount in EUR (fixed rates), used for sorting only */
  annualEur?: number;
}

export interface Job {
  id: string;
  source: Ats;
  company: string;
  segment: Source["segment"];
  title: string;
  position: Position;
  /** ICAO type designators of the aircraft flown in this job */
  aircraft: string[];
  location?: string;
  country?: string;
  /** World region of the job, and the licence regime it normally requires */
  region: RegionId;
  authority: Authority;
  employment?: string;
  postedAt?: string;
  url: string;
  requirements: Requirements;
  salary?: Salary;
  fetchedAt: string;
}

/** The subscriber's experience, computed on their device from the logbook and licences. */
export interface PilotProfile {
  totalMin: number;
  /** pilot-in-command time only; PICUS is never counted as PIC for a requirement */
  picMin: number;
  /** PIC under supervision, apart */
  picusMin?: number;
  /** PIC on jet or on multi-engine turboprop */
  picJetOrMeTurbopropMin?: number;
  /** figures Geardown could not classify (unknown engine, carry-forwards without type or PICUS detail) */
  unknown?: { engineMin: number; openingNoTypeMin: number; openingPicMin: number };
  multiPilotMin: number;
  multiEngineMin: number;
  turbineMin: number;
  jetMin: number;
  /** block minutes per ICAO type */
  typeMin: Record<string, number>;
  /** ICAO types the pilot holds a rating on (from licences/ratings or logged on type) */
  ratedTypes: string[];
  licence?: LicenceLevel;
  englishLevel?: number;
  /** holds an instructor rating or certificate (FI, CRI, IRI, TRI, SFI…) */
  instructor?: boolean;
  /** holds an examiner certificate (FE, TRE, SFE, IRE…) */
  examiner?: boolean;
  /** Licence regimes held (EASA, FAA, UK CAA…) */
  authorities: Authority[];
  /** Regions where the pilot is allowed to work (citizenship, visas) */
  workRegions: RegionId[];
}
