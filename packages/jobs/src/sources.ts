import type { Source } from "./types";

/**
 * Employers whose own public job feeds Strato reads. Only official employer feeds (the ATS endpoints that power
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
];
