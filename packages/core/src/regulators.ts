import type { RegulatoryFramework } from "./types";

/**
 * Licensing authorities a pilot can choose as "main authority". Each maps onto the rule family Geardown
 * implements: the logbook layout of the PDF export and the recent-experience rules.
 *  - "EASA": ICAO Annex 1 style logbook (AMC1 FCL.050 columns) and recency of 3 takeoffs/landings in 90 days,
 *    the basis of most authorities' rules.
 *  - "FAA": 14 CFR 61.51 logbook and 61.57 currency (night full-stop landings, IFR approaches).
 *  - "CASA": CASR Part 61 logbook layout, recency like EASA.
 */
export type RegulatorId =
  | "EASA" | "UKCAA" | "FOCA"
  | "FAA" | "TCCA" | "ANAC_BR" | "ANAC_AR" | "DGAC_CL"
  | "GCAA" | "QCAA" | "GACA" | "CAAI" | "SACAA"
  | "CASA" | "NZCAA" | "CAAC" | "HKCAD" | "JCAB" | "DGCA";

export interface Regulator {
  id: RegulatorId;
  /** short name as pilots say it */
  short: string;
  name: string;
  country: string;
  region: "europe" | "americas" | "mena" | "apac";
  /** logbook layout and recency rules applied */
  framework: RegulatoryFramework;
  /** the rule the logbook follows, shown to the pilot */
  basis: string;
}

export const REGULATORS: Regulator[] = [
  { id: "EASA", short: "EASA", name: "European Union Aviation Safety Agency", country: "EU", region: "europe", framework: "EASA", basis: "Part-FCL, AMC1 FCL.050" },
  { id: "UKCAA", short: "UK CAA", name: "United Kingdom Civil Aviation Authority", country: "GB", region: "europe", framework: "EASA", basis: "UK Part-FCL, CAP 407" },
  { id: "FOCA", short: "FOCA", name: "Federal Office of Civil Aviation (Switzerland)", country: "CH", region: "europe", framework: "EASA", basis: "Part-FCL, AMC1 FCL.050" },
  { id: "FAA", short: "FAA", name: "Federal Aviation Administration (USA)", country: "US", region: "americas", framework: "FAA", basis: "14 CFR 61.51 and 61.57" },
  { id: "TCCA", short: "TCCA", name: "Transport Canada Civil Aviation", country: "CA", region: "americas", framework: "EASA", basis: "CAR 401" },
  { id: "ANAC_BR", short: "ANAC", name: "Agência Nacional de Aviação Civil (Brazil)", country: "BR", region: "americas", framework: "EASA", basis: "RBAC 61" },
  { id: "ANAC_AR", short: "ANAC", name: "Administración Nacional de Aviación Civil (Argentina)", country: "AR", region: "americas", framework: "EASA", basis: "RAAC 61" },
  { id: "DGAC_CL", short: "DGAC", name: "Dirección General de Aeronáutica Civil (Chile)", country: "CL", region: "americas", framework: "EASA", basis: "DAR 01" },
  { id: "GCAA", short: "GCAA", name: "General Civil Aviation Authority (UAE)", country: "AE", region: "mena", framework: "EASA", basis: "CAR-FCL" },
  { id: "QCAA", short: "QCAA", name: "Qatar Civil Aviation Authority", country: "QA", region: "mena", framework: "EASA", basis: "QCAR-FCL" },
  { id: "GACA", short: "GACA", name: "General Authority of Civil Aviation (Saudi Arabia)", country: "SA", region: "mena", framework: "EASA", basis: "GACAR Part 61" },
  { id: "CAAI", short: "CAAI", name: "Civil Aviation Authority of Israel", country: "IL", region: "mena", framework: "EASA", basis: "Air Navigation Regulations" },
  { id: "SACAA", short: "SACAA", name: "South African Civil Aviation Authority", country: "ZA", region: "mena", framework: "EASA", basis: "SA-CAR Part 61" },
  { id: "CASA", short: "CASA", name: "Civil Aviation Safety Authority (Australia)", country: "AU", region: "apac", framework: "CASA", basis: "CASR Part 61" },
  { id: "NZCAA", short: "CAA NZ", name: "Civil Aviation Authority of New Zealand", country: "NZ", region: "apac", framework: "CASA", basis: "CAR Part 61" },
  { id: "CAAC", short: "CAAC", name: "Civil Aviation Administration of China", country: "CN", region: "apac", framework: "EASA", basis: "CCAR-61" },
  { id: "HKCAD", short: "HKCAD", name: "Civil Aviation Department (Hong Kong)", country: "HK", region: "apac", framework: "EASA", basis: "HK Air Navigation Order" },
  { id: "JCAB", short: "JCAB", name: "Japan Civil Aviation Bureau", country: "JP", region: "apac", framework: "EASA", basis: "Civil Aeronautics Act" },
  { id: "DGCA", short: "DGCA", name: "Directorate General of Civil Aviation (India)", country: "IN", region: "apac", framework: "EASA", basis: "CAR Section 7" },
];

export const regulatorById = (id?: string | null) => REGULATORS.find((r) => r.id === id);

/** The rule family for a pilot: the chosen authority's, else the stored framework. */
export const frameworkOf = (pilot: { authority?: string | null; regulatoryFramework: RegulatoryFramework }): RegulatoryFramework =>
  regulatorById(pilot.authority)?.framework ?? pilot.regulatoryFramework;
