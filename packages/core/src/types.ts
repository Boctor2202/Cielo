/**
 * Geardown domain model.
 * Conventions: every duration is an integer number of minutes, every instant
 * is an ISO-8601 UTC string. Synced records carry id/createdAt/updatedAt/deletedAt.
 */

export type UUID = string;
export type ISODateTime = string; // 2026-11-10T08:35:00.000Z
export type ISODate = string; // 2026-11-10

export interface SyncedRecord {
  id: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime | null;
}

export type Locale = "fr" | "en";
export type RegulatoryFramework = "EASA" | "FAA" | "CASA";
export type SubscriptionTier = "free" | "basic" | "premium";
export type SubscriptionSource = "stripe" | "apple" | "google" | null;
export type TimeDisplay = "hhmm" | "decimal";

/** Pilot function on a given flight. */
export type PilotFunction = "PIC" | "SIC" | "PICUS" | "DUAL" | "FI" | "FE";
export const PILOT_FUNCTIONS: PilotFunction[] = ["PIC", "SIC", "PICUS", "DUAL", "FI", "FE"];

export type IfrDefault = "never" | "always" | "ask";
export type PilotFlyingRule = "always" | "never" | "alternate";

export interface Pilot extends SyncedRecord {
  email: string;
  fullName: string;
  displayName?: string;
  locale: Locale;
  regulatoryFramework: RegulatoryFramework;
  homeBaseIcao?: string;
  /** flight time limitation scheme: EASA ORO.FTL, EU-OPS Subpart Q (business aviation, air taxi) or none */
  ftlRegime?: FtlRegime;
  licenceNumber?: string;
  defaultFunction: PilotFunction;
  defaultIfr: IfrDefault;
  defaultPilotFlying: PilotFlyingRule;
  timeDisplay: TimeDisplay;
  signatureDataUrl?: string;
  /** Profile photo: small square JPEG data URL, resized on the device */
  photoDataUrl?: string;
  /** Position, e.g. "Captain", "First Officer", "Flight Instructor" */
  rank?: string;
  employer?: string;
  /** ISO 3166-1 alpha-2 */
  nationality?: string;
  phone?: string;
  bio?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionSource: SubscriptionSource;
  subscriptionExpiresAt?: ISODateTime | null;
}

export type AircraftCategory = "airplane" | "helicopter" | "glider" | "tmg" | "balloon" | "airship" | "ulm";
export type EngineType = "piston" | "turboprop" | "jet" | "turboshaft" | "electric" | "none";

export interface AircraftType extends SyncedRecord {
  /** ICAO type designator, e.g. A320, C172, PC12 */
  icao: string;
  manufacturer: string;
  model: string;
  category: AircraftCategory;
  engineType: EngineType;
  engineCount: number;
  /** Certified for multi-pilot operation */
  multiPilot: boolean;
  /** SEP(L), MEP(L), TR A320... */
  classOrTypeRating?: string;
  /** null = public reference data */
  ownerPilotId?: UUID | null;
}

export type OperationMode = "single_pilot" | "multi_pilot";

export interface Aircraft extends SyncedRecord {
  pilotId: UUID;
  registration: string;
  aircraftTypeId: UUID;
  variant?: string;
  operator?: string;
  complex?: boolean;
  highPerformance?: boolean;
  tailwheel?: boolean;
  defaultOperation: OperationMode;
  notes?: string;
  /** 24-bit ICAO (Mode S) address in hex, learned from ADS-B; used to fetch flight tracks */
  icaoHex?: string;
}

export interface Airport {
  id: UUID | string;
  icao: string;
  iata?: string;
  name: string;
  city?: string;
  country: string;
  lat: number;
  lon: number;
  elevationFt?: number;
  timezone?: string;
  /** 3 large airport, 2 medium, 1 small aerodrome (reference data only) */
  size?: number;
  ownerPilotId?: UUID | null;
}

export interface Approach {
  type: string; // ILS CAT I, RNP, VOR...
  runway?: string;
  count: number;
}

export interface CrewMember {
  name: string;
  role: string;
}

export type FlightSource = "manual" | "import" | "roster" | "scan";

export interface Flight extends SyncedRecord {
  pilotId: UUID;
  /** UTC date of off-block */
  date: ISODate;
  flightNumber?: string;
  source: FlightSource;
  rosterEventId?: UUID | null;

  depIcao: string;
  arrIcao: string;
  outUtc?: ISODateTime | null;
  offUtc?: ISODateTime | null;
  onUtc?: ISODateTime | null;
  inUtc?: ISODateTime | null;

  aircraftId?: UUID | null;
  /** snapshots so the logbook stays exact if the aircraft record changes */
  registration?: string;
  aircraftTypeIcao?: string;
  aircraftModel?: string;

  totalMin: number;
  airMin: number;
  singlePilotSeMin: number;
  singlePilotMeMin: number;
  multiPilotMin: number;

  function: PilotFunction;
  picName?: string;
  picMin: number;
  picusMin: number;
  copilotMin: number;
  dualMin: number;
  instructorMin: number;
  examinerMin: number;

  nightMin: number;
  ifrMin: number;
  actualImcMin: number;
  xcMin: number;
  nightCalc: "auto" | "manual";

  takeoffsDay: number;
  takeoffsNight: number;
  landingsDay: number;
  landingsNight: number;
  pilotFlying: boolean;

  approaches: Approach[];

  isFstd: boolean;
  fstdType?: string;
  fstdQualification?: string;
  fstdMin: number;

  crew: CrewMember[];
  remarks?: string;
  signatureId?: UUID | null;
  locked: boolean;
}

export interface Signature extends SyncedRecord {
  pilotId: UUID;
  flightId: UUID;
  signerName: string;
  signerRole: "instructor" | "captain" | "examiner" | "other";
  signerLicenceNumber?: string;
  signedAt: ISODateTime;
  imageDataUrl: string;
  /** SHA-256 of the canonical flight content at signing time */
  contentHash: string;
}

/** Totals carried forward from a previous (paper) logbook. */
export interface OpeningBalance extends SyncedRecord {
  pilotId: UUID;
  asOfDate: ISODate;
  label?: string;
  aircraftTypeIcao?: string | null;
  totalMin: number;
  singlePilotSeMin: number;
  singlePilotMeMin: number;
  multiPilotMin: number;
  picMin: number;
  copilotMin: number;
  dualMin: number;
  instructorMin: number;
  nightMin: number;
  ifrMin: number;
  landingsDay: number;
  landingsNight: number;
  fstdMin: number;
}

export type LicenseKind = "licence" | "medical" | "rating" | "endorsement" | "language" | "other";

export interface License extends SyncedRecord {
  pilotId: UUID;
  kind: LicenseKind;
  /** PPL(A), CPL(A), ATPL(A), LAPL(A), CLASS1, SEP(L), MEP(L), TR A320, IR(A), FI(A), NVFR, LPE... */
  code: string;
  authority?: string;
  number?: string;
  issuedOn?: ISODate | null;
  validUntil?: ISODate | null;
  lastCheckOn?: ISODate | null;
  alertDays: number[];
  notes?: string;
  attachmentDataUrl?: string;
}

export type RosterSource = "csv" | "ical" | "ical_url" | "manual";

export interface Roster extends SyncedRecord {
  pilotId: UUID;
  source: RosterSource;
  fileName?: string;
  periodStart?: ISODate;
  periodEnd?: ISODate;
  importedAt: ISODateTime;
}

export type RosterEventKind = "FLIGHT" | "DEADHEAD" | "STANDBY" | "SIM" | "GROUND" | "OFF" | "REST" | "LEAVE" | "OTHER";

export interface RosterEvent extends SyncedRecord {
  pilotId: UUID;
  rosterId?: UUID | null;
  kind: RosterEventKind;
  title?: string;
  reportUtc?: ISODateTime | null;
  startUtc: ISODateTime;
  endUtc: ISODateTime;
  debriefUtc?: ISODateTime | null;
  flightNumber?: string;
  depIcao?: string;
  arrIcao?: string;
  aircraftReg?: string;
  aircraftTypeIcao?: string;
  crew?: CrewMember[];
  flightId?: UUID | null;
  externalUid?: string;
}

/** A point of a recorded track: [unix seconds, lat, lon, barometric altitude ft (null on the ground), ground speed kt]. */
export type TrackPoint = [number, number, number, number | null, number | null];

/** The real track of a logged flight (ADS-B), stored apart from the flight so the logbook stays light. id = flight id. */
export interface FlightTrack extends SyncedRecord {
  pilotId: UUID;
  flightId: UUID;
  /** ICAO address of the aircraft */
  hex: string;
  source: "adsb.lol" | "flightaware";
  /** simplified track, oldest first */
  points: TrackPoint[];
  fetchedAt: ISODateTime;
}

export interface Layover extends SyncedRecord {
  pilotId: UUID;
  airportIcao: string;
  rosterEventId?: UUID | null;
  arrivalUtc?: ISODateTime | null;
  departureUtc?: ISODateTime | null;
  hotelName?: string;
  /** Google place ID of the crew hotel (the only Google data we may store) */
  hotelPlaceId?: string;
  address?: string;
  phone?: string;
  notes?: string;
  contacts: { name: string; phone?: string; role?: string }[];
}

export type FtlRegime = "oro" | "subq" | "none";
