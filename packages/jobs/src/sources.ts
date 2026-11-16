import type { Source } from "./types";

/**
 * Employers whose own public job feeds Geardown reads. Only official employer feeds (the ATS endpoints that power
 * their careers pages) — never third-party job boards, whose listings belong to them.
 * To add an employer: find the ATS behind their careers page and its board token, then add a line.
 */
export const SOURCES: Source[] = [
  { company: "Aston Jet", ats: "recruitee", token: "astonjet", segment: "business" },
  { company: "Transavia", ats: "recruitee", token: "transavia", segment: "airline" },
  { company: "Corendon Airlines", ats: "recruitee", token: "corendon", segment: "airline" },
  { company: "Norse Atlantic Airways", ats: "teamtailor", token: "norse", segment: "airline" },
  { company: "Volotea", ats: "teamtailor", token: "volotea", segment: "airline" },
  { company: "Vueling", ats: "teamtailor", token: "vueling", segment: "airline" },
  { company: "Babcock", ats: "teamtailor", token: "babcock", segment: "helicopter" },
  { company: "Platoon Aviation", ats: "personio", token: "platoon-aviation", country: "DE", segment: "business" },
  { company: "Luxaviation", ats: "personio", token: "luxaviation", segment: "business" },
  { company: "GlobeAir", ats: "personio", token: "globeair", country: "AT", segment: "business" },
  { company: "German Airways", ats: "personio", token: "german-airways", country: "DE", segment: "regional" },
  { company: "Zimex Aviation", ats: "personio", token: "zimex", country: "CH", segment: "regional" },
  { company: "Windrose Aviation", ats: "personio", token: "windrose", country: "DE", segment: "business" },
  { company: "Hahn Air", ats: "personio", token: "hahnair", country: "DE", segment: "airline" },
  { company: "Atlas Air", ats: "greenhouse", token: "atlasair", country: "US", segment: "cargo" },
  // North America
  { company: "Starlink Aviation", ats: "workable", token: "starlink-aviation", country: "CA", segment: "business" },
  { company: "Western Aircraft", ats: "lever", token: "westair", country: "US", segment: "business" },
  { company: "Aero", ats: "lever", token: "aero", country: "US", segment: "business" },
  { company: "Four Corners Aviation", ats: "greenhouse", token: "fourcornersaviation", country: "US", segment: "business" },
  { company: "Archer Aviation", ats: "greenhouse", token: "archer56", country: "US", segment: "other" },
  // Europe
  { company: "Marabu Airlines", ats: "workable", token: "marabu", country: "DE", segment: "airline" },
  { company: "Compass Cargo Airlines", ats: "workable", token: "compass-cargo-airlines", country: "BG", segment: "cargo" },
  { company: "Luminair", ats: "personio", token: "luminair", country: "DE", segment: "business" },
  { company: "Excellent Air", ats: "personio", token: "excellent-air", country: "DE", segment: "business" },
  { company: "Eisele Flugdienst", ats: "personio", token: "eisele", country: "DE", segment: "business" },
  // Asia-Pacific, Africa
  { company: "Beond", ats: "workable", token: "beond", country: "MV", segment: "airline" },
  { company: "Air New Zealand", ats: "smartrecruiters", token: "AirNewZealand", country: "NZ", segment: "airline" },
  { company: "Airlink", ats: "workable", token: "airlink", country: "ZA", segment: "regional" },
  { company: "FlySafair", ats: "workable", token: "flysafair", country: "ZA", segment: "airline" },
  // SAP SuccessFactors career sites
  { company: "NetJets", ats: "successfactors", token: "netjets.jobs.hr.cloud.sap", country: "US", segment: "business" },
  { company: "KLM", ats: "successfactors", token: "vacancy.klm.com", country: "NL", segment: "airline" },
];
