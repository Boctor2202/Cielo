import type { AircraftCategory, EngineType, RosterEventKind } from "./types";

/** Option lists shared by the web and mobile forms. */

/** Positions offered for the pilot profile (free text stays possible). */
export const RANKS = ["Captain", "Commandant de bord", "First Officer", "Officier pilote de ligne", "Senior First Officer", "Flight Instructor", "Instructeur", "Student Pilot", "Élève pilote", "Private Pilot", "Pilote privé"];

/** Instrument approach types logged with a flight. */
export const APPROACH_TYPES = ["ILS CAT I", "ILS CAT II", "ILS CAT III", "LOC", "RNP", "RNP AR", "LPV", "VOR", "NDB", "GLS", "PAR", "Visual", "Circling"];

export const ROSTER_KINDS: RosterEventKind[] = ["FLIGHT", "DEADHEAD", "STANDBY", "SIM", "GROUND", "OFF", "REST", "LEAVE", "OTHER"];

export const AIRCRAFT_CATEGORIES: AircraftCategory[] = ["airplane", "helicopter", "glider", "tmg", "ulm", "balloon", "airship"];
export const ENGINE_TYPES: EngineType[] = ["piston", "turboprop", "jet", "turboshaft", "electric", "none"];
