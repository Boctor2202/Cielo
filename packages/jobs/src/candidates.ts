import type { Source } from "./types";

/**
 * Employers to try (temporary): official careers-page feeds guessed from the ATS each one is known or likely to use.
 * The ones that answer with pilot jobs move to SOURCES; this file is then emptied.
 */
export const CANDIDATES: Source[] = [
  { company: "Breeze Airways", ats: "greenhouse", token: "breezeairways", country: "US", segment: "airline" },
  { company: "Four Corners Aviation", ats: "greenhouse", token: "fourcornersaviation", country: "US", segment: "business" },
  { company: "Sol Aerial Surveys", ats: "greenhouse", token: "solaerialsurveysllc", country: "US", segment: "other" },
  { company: "Aero", ats: "lever", token: "aero", country: "US", segment: "business" },
  { company: "Western Aircraft", ats: "lever", token: "westair", country: "US", segment: "business" },
  { company: "Compass Cargo Airlines", ats: "workable", token: "compass-cargo-airlines", country: "BG", segment: "cargo" },
  { company: "Beond", ats: "workable", token: "beond", country: "MV", segment: "airline" },
  { company: "Marabu Airlines", ats: "workable", token: "marabu-airlines", country: "DE", segment: "airline" },
  { company: "Marabu Airlines", ats: "workable", token: "marabu", country: "DE", segment: "airline" },
  { company: "Marabu Airlines", ats: "workable", token: "marabuairlines", country: "DE", segment: "airline" },
  { company: "Starlink Aviation", ats: "workable", token: "starlink-aviation", country: "CA", segment: "business" },
  { company: "Starlink Aviation", ats: "workable", token: "starlinkaviation", country: "CA", segment: "business" },
  { company: "Luminair", ats: "personio", token: "luminair", country: "DE", segment: "business" },
  { company: "Excellent Air", ats: "personio", token: "excellent-air", country: "DE", segment: "business" },
  { company: "Air New Zealand", ats: "smartrecruiters", token: "AirNewZealand", country: "NZ", segment: "airline" },
  { company: "Archer Aviation", ats: "greenhouse", token: "archer56", country: "US", segment: "other" },
  { company: "Zipline", ats: "greenhouse", token: "flyzipline", country: "US", segment: "other" },
  { company: "Merlin Labs", ats: "lever", token: "merlinlabs", country: "US", segment: "other" },
  { company: "Elroy Air", ats: "lever", token: "elroyair", country: "US", segment: "other" },
  { company: "Eisele Flugdienst", ats: "personio", token: "eisele", country: "DE", segment: "business" },
  { company: "Airlink", ats: "workable", token: "airlink", country: "ZA", segment: "regional" },
  { company: "FlySafair", ats: "workable", token: "flysafair", country: "ZA", segment: "airline" },
];
