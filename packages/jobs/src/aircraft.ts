import { AIRCRAFT_TYPES } from "@cielo/reference-data";

/**
 * Aircraft names as they appear in job ads → ICAO designators. Types sharing a type rating are grouped
 * (an A320 rating covers A319/A321, a B737 rating covers NG/MAX…).
 */
const ALIASES: [RegExp, string[]][] = [
  [/\b(?:A|Airbus) ?32[01]\b|\b(?:A|Airbus) ?319\b|\b(?:A|Airbus) ?321\b|\b(?:A|Airbus) ?320 ?(?:family|fam|neo|ceo)\b|\b(?:A|Airbus) ?32[01] ?neo\b/i, ["A320", "A319", "A321", "A20N", "A21N", "A19N", "A318"]],
  [/\b(?:A|Airbus) ?220\b|\bC ?Series\b|\bCS ?(?:100|300)\b/i, ["BCS1", "BCS3"]],
  [/\b(?:A|Airbus) ?330\b|\b(?:A|Airbus) ?339\b/i, ["A332", "A333", "A339"]],
  [/\b(?:A|Airbus) ?350\b/i, ["A359", "A35K"]],
  [/\b(?:A|Airbus) ?380\b/i, ["A388"]],
  [/\b(?:B|Boeing) ?737\b|\b737 ?(?:NG|MAX|-?[6-9]00)\b|\b(?:B|Boeing) ?73[789]\b|\bB3[89]M\b/i, ["B737", "B738", "B739", "B38M", "B39M"]],
  [/\b(?:B|Boeing) ?757\b|\b(?:B|Boeing) ?767\b/i, ["B752", "B763"]],
  [/\b(?:B|Boeing) ?777\b|\b777F?\b/i, ["B772", "B77W"]],
  [/\b(?:B|Boeing) ?787\b|\bDreamliner\b/i, ["B788", "B789", "B78X"]],
  [/\b(?:B|Boeing) ?747\b|\b747 ?-?(?:400|8)F?\b/i, ["B744", "B748"]],
  [/\bE ?1[79]5?\b|\bE-?Jet\b|\bE ?190\b|\bE ?195\b|\bE2\b/i, ["E170", "E175", "E190", "E195", "E290", "E295"]],
  [/\bERJ ?1[34]5\b/i, ["E145"]],
  [/\bCRJ ?(?:700|900|1000)?\b/i, ["CRJ7", "CRJ9", "CRJX"]],
  [/\bATR ?(?:42|72)?\b/i, ["AT45", "AT46", "AT75", "AT76"]],
  [/\bQ ?400\b|\bDash ?8\b|\bDHC-?8\b/i, ["DH8D"]],
  [/\bDHC-?6\b|\bTwin Otter\b/i, ["DHC6"]],
  [/\bCitation Latitude\b|\bC ?680A\b|\bC68A\b/i, ["C68A"]],
  [/\bCitation Longitude\b|\bC700\b/i, ["C700"]],
  [/\bCitation (?:XLS|Excel)\b|\bC56X\b|\bC ?560 ?XL\b/i, ["C56X"]],
  [/\bCitation (?:CJ ?[234]|M2)\b|\bCJ ?[234]\b|\bC525\b/i, ["C25A", "C25B", "C25C"]],
  [/\bCitation Mustang\b|\bC510\b/i, ["C510"]],
  [/\bPhenom ?100\b|\bPhenom ?300\b|\bEMB-?50[05]\b/i, ["E50P", "E55P"]],
  [/\bPraetor\b|\bLegacy ?(?:450|500)\b/i, ["E545", "E550"]],
  [/\bLegacy ?6[05]0\b/i, ["E35L"]],
  [/\bPC-?24\b/i, ["PC24"]],
  [/\bPC-?12\b/i, ["PC12"]],
  [/\bChallenger ?3[05]0\b|\bCL ?3[05]0?\b/i, ["CL30", "CL35"]],
  [/\bChallenger ?6[05]\d\b|\bCL ?60[45]?\b/i, ["CL60"]],
  [/\bGlobal ?(?:Express|5000|5500|6000|6500|XRS)\b|\bBD-?700\b|\bGLEX\b/i, ["GLEX"]],
  [/\bGlobal ?7500\b|\bGlobal ?8000\b/i, ["GL7T"]],
  [/\bFalcon ?2000\b|\bF2TH\b/i, ["F2TH"]],
  [/\bFalcon ?(?:7X|8X)\b/i, ["FA7X", "FA8X"]],
  [/\bFalcon ?6X\b/i, ["FA6X"]],
  [/\bFalcon ?900(?:EX|LX|DX|B|C)?(?: EASy)?\b/i, ["FA900"]],
  [/\bFalcon ?50\b/i, ["FA50"]],
  [/\bG ?(?:IV|450)\b|\bGulfstream ?(?:IV|450)\b/i, ["GLF4"]],
  [/\bG ?(?:V|550|500|600)\b|\bGulfstream ?(?:V|550)\b/i, ["GLF5"]],
  [/\bG ?650(?:ER)?\b/i, ["GLF6"]],
  [/\bG ?280\b/i, ["G280"]],
  [/\bLearjet ?(?:4[05]|75)\b/i, ["LJ45", "LJ75"]],
  [/\bHawker ?(?:800|850|900)\b/i, ["H25B"]],
  [/\bKing ?Air\b|\bB ?350\b|\bBE20\b/i, ["BE20", "B350", "BE9L"]],
  [/\bTBM\b/i, ["TBM7", "TBM8", "TBM9"]],
  [/\bAW ?139\b/i, ["A139"]],
  [/\bH ?1[34]5\b|\bEC ?1[34]5\b/i, ["EC35", "EC45"]],
  [/\bH ?125\b|\bAS ?350\b|\bEcureuil\b/i, ["AS50"]],
  [/\bS-?76\b/i, ["S76"]],
];

const BY_ICAO = new Map(AIRCRAFT_TYPES.map((t) => [t.icao, t]));

/** ICAO designators of aircraft named in a job title / text, most specific first. */
export function detectAircraft(text: string): string[] {
  const out: string[] = [];
  for (const [re, icaos] of ALIASES) if (re.test(text)) for (const i of icaos) if (!out.includes(i)) out.push(i);
  return out;
}

/** Two types are "same rating family" when an alias group contains both. */
export function sameFamily(a: string, b: string): boolean {
  if (a === b) return true;
  return ALIASES.some(([, g]) => g.includes(a) && g.includes(b));
}

export function typeInfo(icao: string) {
  return BY_ICAO.get(icao);
}
