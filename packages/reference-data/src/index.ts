import type { AircraftCategory, AircraftType, Airport, EngineType } from "@cielo/core";

type Row = [string, string, string, AircraftCategory, EngineType, number, boolean, string];

/** Common aircraft types (ICAO Doc 8643 designators). Extend freely; pilots can also add their own. */
const TYPES: Row[] = [
  // Light single-engine piston
  ["C150", "Cessna", "150", "airplane", "piston", 1, false, "SEP(land)"],
  ["C152", "Cessna", "152", "airplane", "piston", 1, false, "SEP(land)"],
  ["C172", "Cessna", "172 Skyhawk", "airplane", "piston", 1, false, "SEP(land)"],
  ["C177", "Cessna", "177 Cardinal", "airplane", "piston", 1, false, "SEP(land)"],
  ["C182", "Cessna", "182 Skylane", "airplane", "piston", 1, false, "SEP(land)"],
  ["C206", "Cessna", "206 Stationair", "airplane", "piston", 1, false, "SEP(land)"],
  ["C210", "Cessna", "210 Centurion", "airplane", "piston", 1, false, "SEP(land)"],
  ["P28A", "Piper", "PA-28 Cherokee / Warrior / Archer", "airplane", "piston", 1, false, "SEP(land)"],
  ["P28R", "Piper", "PA-28R Arrow", "airplane", "piston", 1, false, "SEP(land)"],
  ["PA46", "Piper", "PA-46 Malibu / Mirage", "airplane", "piston", 1, false, "SEP(land)"],
  ["P46T", "Piper", "PA-46 Meridian / M500 / M600", "airplane", "turboprop", 1, false, "SET(land)"],
  ["DR40", "Robin", "DR400", "airplane", "piston", 1, false, "SEP(land)"],
  ["DR22", "Robin", "DR220 / DR221", "airplane", "piston", 1, false, "SEP(land)"],
  ["R200", "Robin", "HR200 / R2000", "airplane", "piston", 1, false, "SEP(land)"],
  ["DV20", "Diamond", "DV20 / DA20 Katana", "airplane", "piston", 1, false, "SEP(land)"],
  ["DA40", "Diamond", "DA40 Diamond Star", "airplane", "piston", 1, false, "SEP(land)"],
  ["SR20", "Cirrus", "SR20", "airplane", "piston", 1, false, "SEP(land)"],
  ["SR22", "Cirrus", "SR22", "airplane", "piston", 1, false, "SEP(land)"],
  ["S22T", "Cirrus", "SR22T", "airplane", "piston", 1, false, "SEP(land)"],
  ["BE35", "Beechcraft", "Bonanza 35", "airplane", "piston", 1, false, "SEP(land)"],
  ["BE36", "Beechcraft", "Bonanza 36", "airplane", "piston", 1, false, "SEP(land)"],
  ["M20P", "Mooney", "M20", "airplane", "piston", 1, false, "SEP(land)"],
  ["TB10", "Socata", "TB10 Tobago", "airplane", "piston", 1, false, "SEP(land)"],
  ["TB20", "Socata", "TB20 Trinidad", "airplane", "piston", 1, false, "SEP(land)"],
  ["CAP2", "Mudry", "CAP 10", "airplane", "piston", 1, false, "SEP(land)"],
  ["EXTR", "Extra", "EA-300", "airplane", "piston", 1, false, "SEP(land)"],
  ["AAT3", "Aquila", "A210", "airplane", "piston", 1, false, "SEP(land)"],
  ["TECN", "Tecnam", "P2002 / P2008", "airplane", "piston", 1, false, "SEP(land)"],
  ["PIVI", "Pipistrel", "Velis Electro", "airplane", "electric", 1, false, "SEP(land)"],
  ["J3", "Piper", "J-3 Cub", "airplane", "piston", 1, false, "SEP(land)"],
  ["PA18", "Piper", "PA-18 Super Cub", "airplane", "piston", 1, false, "SEP(land)"],
  // Multi-engine piston
  ["DA42", "Diamond", "DA42 Twin Star", "airplane", "piston", 2, false, "MEP(land)"],
  ["DA62", "Diamond", "DA62", "airplane", "piston", 2, false, "MEP(land)"],
  ["PA34", "Piper", "PA-34 Seneca", "airplane", "piston", 2, false, "MEP(land)"],
  ["PA44", "Piper", "PA-44 Seminole", "airplane", "piston", 2, false, "MEP(land)"],
  ["BE58", "Beechcraft", "Baron 58", "airplane", "piston", 2, false, "MEP(land)"],
  ["BE76", "Beechcraft", "Duchess", "airplane", "piston", 2, false, "MEP(land)"],
  ["P68", "Vulcanair", "P68", "airplane", "piston", 2, false, "MEP(land)"],
  ["TECN2", "Tecnam", "P2006T", "airplane", "piston", 2, false, "MEP(land)"],
  // Single turboprop
  ["TBM7", "Daher", "TBM 700", "airplane", "turboprop", 1, false, "TBM 700/900"],
  ["TBM8", "Daher", "TBM 850", "airplane", "turboprop", 1, false, "TBM 700/900"],
  ["TBM9", "Daher", "TBM 900 / 940 / 960", "airplane", "turboprop", 1, false, "TBM 700/900"],
  ["PC12", "Pilatus", "PC-12", "airplane", "turboprop", 1, false, "PC-12"],
  ["PC6T", "Pilatus", "PC-6 Turbo Porter", "airplane", "turboprop", 1, false, "SET(land)"],
  ["C208", "Cessna", "208 Caravan", "airplane", "turboprop", 1, false, "SET(land)"],
  ["KODI", "Daher", "Kodiak 100", "airplane", "turboprop", 1, false, "SET(land)"],
  // Twin turboprop
  ["BE20", "Beechcraft", "King Air 200", "airplane", "turboprop", 2, false, "BE90/99/100/200"],
  ["B350", "Beechcraft", "King Air 350", "airplane", "turboprop", 2, false, "BE90/99/100/200"],
  ["BE9L", "Beechcraft", "King Air 90", "airplane", "turboprop", 2, false, "BE90/99/100/200"],
  ["P180", "Piaggio", "P180 Avanti", "airplane", "turboprop", 2, false, "P180"],
  ["DHC6", "De Havilland Canada", "DHC-6 Twin Otter", "airplane", "turboprop", 2, false, "DHC-6"],
  ["AT45", "ATR", "ATR 42-500", "airplane", "turboprop", 2, true, "ATR 42/72"],
  ["AT46", "ATR", "ATR 42-600", "airplane", "turboprop", 2, true, "ATR 42/72"],
  ["AT75", "ATR", "ATR 72-500", "airplane", "turboprop", 2, true, "ATR 42/72"],
  ["AT76", "ATR", "ATR 72-600", "airplane", "turboprop", 2, true, "ATR 42/72"],
  ["DH8D", "De Havilland Canada", "Dash 8-400", "airplane", "turboprop", 2, true, "DHC-8"],
  ["SF34", "Saab", "340", "airplane", "turboprop", 2, true, "SF340"],
  ["B190", "Beechcraft", "1900D", "airplane", "turboprop", 2, true, "BE1900"],
  ["JS32", "BAe", "Jetstream 32", "airplane", "turboprop", 2, true, "HP137/Jetstream"],
  ["D328", "Dornier", "328", "airplane", "turboprop", 2, true, "Do328"],
  // Business jets
  ["C25A", "Cessna", "Citation CJ2", "airplane", "jet", 2, false, "C525"],
  ["C25B", "Cessna", "Citation CJ3", "airplane", "jet", 2, false, "C525"],
  ["C25C", "Cessna", "Citation CJ4", "airplane", "jet", 2, false, "C525"],
  ["C510", "Cessna", "Citation Mustang", "airplane", "jet", 2, false, "C510"],
  ["C56X", "Cessna", "Citation Excel / XLS", "airplane", "jet", 2, true, "C560XL"],
  ["C68A", "Cessna", "Citation Latitude", "airplane", "jet", 2, true, "C680A"],
  ["C700", "Cessna", "Citation Longitude", "airplane", "jet", 2, true, "C700"],
  ["E50P", "Embraer", "Phenom 100", "airplane", "jet", 2, false, "EMB-500/505"],
  ["E55P", "Embraer", "Phenom 300", "airplane", "jet", 2, false, "EMB-500/505"],
  ["E545", "Embraer", "Legacy 450 / Praetor 500", "airplane", "jet", 2, true, "EMB-545/550"],
  ["E550", "Embraer", "Legacy 500 / Praetor 600", "airplane", "jet", 2, true, "EMB-545/550"],
  ["E35L", "Embraer", "Legacy 600/650", "airplane", "jet", 2, true, "EMB-135/145"],
  ["PC24", "Pilatus", "PC-24", "airplane", "jet", 2, false, "PC-24"],
  ["HDJT", "Honda", "HondaJet", "airplane", "jet", 2, false, "HA-420"],
  ["SF50", "Cirrus", "Vision Jet", "airplane", "jet", 1, false, "SF50"],
  ["LJ45", "Learjet", "45", "airplane", "jet", 2, true, "LJ40/45"],
  ["LJ75", "Learjet", "75", "airplane", "jet", 2, true, "LJ40/45"],
  ["CL30", "Bombardier", "Challenger 300", "airplane", "jet", 2, true, "CL300/350"],
  ["CL35", "Bombardier", "Challenger 350", "airplane", "jet", 2, true, "CL300/350"],
  ["CL60", "Bombardier", "Challenger 604/605/650", "airplane", "jet", 2, true, "CL600/605"],
  ["GLEX", "Bombardier", "Global Express / 6000", "airplane", "jet", 2, true, "BD700"],
  ["GL7T", "Bombardier", "Global 7500", "airplane", "jet", 2, true, "BD700"],
  ["F2TH", "Dassault", "Falcon 2000", "airplane", "jet", 2, true, "Falcon 2000"],
  ["FA50", "Dassault", "Falcon 50", "airplane", "jet", 3, true, "Falcon 50"],
  ["FA7X", "Dassault", "Falcon 7X", "airplane", "jet", 3, true, "Falcon 7X/8X"],
  ["FA8X", "Dassault", "Falcon 8X", "airplane", "jet", 3, true, "Falcon 7X/8X"],
  ["FA6X", "Dassault", "Falcon 6X", "airplane", "jet", 2, true, "Falcon 6X"],
  ["FA900", "Dassault", "Falcon 900", "airplane", "jet", 3, true, "Falcon 900"],
  ["GLF4", "Gulfstream", "G-IV / G450", "airplane", "jet", 2, true, "G-IV"],
  ["GLF5", "Gulfstream", "G-V / G550", "airplane", "jet", 2, true, "G-V"],
  ["GLF6", "Gulfstream", "G650", "airplane", "jet", 2, true, "GVI"],
  ["G280", "Gulfstream", "G280", "airplane", "jet", 2, true, "G280"],
  ["H25B", "Hawker", "800 / 850XP / 900XP", "airplane", "jet", 2, true, "HS125"],
  // Airliners
  ["A318", "Airbus", "A318", "airplane", "jet", 2, true, "A320"],
  ["A319", "Airbus", "A319", "airplane", "jet", 2, true, "A320"],
  ["A320", "Airbus", "A320", "airplane", "jet", 2, true, "A320"],
  ["A321", "Airbus", "A321", "airplane", "jet", 2, true, "A320"],
  ["A19N", "Airbus", "A319neo", "airplane", "jet", 2, true, "A320"],
  ["A20N", "Airbus", "A320neo", "airplane", "jet", 2, true, "A320"],
  ["A21N", "Airbus", "A321neo", "airplane", "jet", 2, true, "A320"],
  ["BCS1", "Airbus", "A220-100", "airplane", "jet", 2, true, "A220"],
  ["BCS3", "Airbus", "A220-300", "airplane", "jet", 2, true, "A220"],
  ["A332", "Airbus", "A330-200", "airplane", "jet", 2, true, "A330"],
  ["A333", "Airbus", "A330-300", "airplane", "jet", 2, true, "A330"],
  ["A339", "Airbus", "A330-900neo", "airplane", "jet", 2, true, "A330"],
  ["A343", "Airbus", "A340-300", "airplane", "jet", 4, true, "A340"],
  ["A359", "Airbus", "A350-900", "airplane", "jet", 2, true, "A350"],
  ["A35K", "Airbus", "A350-1000", "airplane", "jet", 2, true, "A350"],
  ["A388", "Airbus", "A380-800", "airplane", "jet", 4, true, "A380"],
  ["B737", "Boeing", "737-700", "airplane", "jet", 2, true, "B737 300-900"],
  ["B738", "Boeing", "737-800", "airplane", "jet", 2, true, "B737 300-900"],
  ["B739", "Boeing", "737-900", "airplane", "jet", 2, true, "B737 300-900"],
  ["B38M", "Boeing", "737 MAX 8", "airplane", "jet", 2, true, "B737 300-900"],
  ["B39M", "Boeing", "737 MAX 9", "airplane", "jet", 2, true, "B737 300-900"],
  ["B752", "Boeing", "757-200", "airplane", "jet", 2, true, "B757/767"],
  ["B763", "Boeing", "767-300", "airplane", "jet", 2, true, "B757/767"],
  ["B772", "Boeing", "777-200", "airplane", "jet", 2, true, "B777/787"],
  ["B77W", "Boeing", "777-300ER", "airplane", "jet", 2, true, "B777/787"],
  ["B788", "Boeing", "787-8", "airplane", "jet", 2, true, "B777/787"],
  ["B789", "Boeing", "787-9", "airplane", "jet", 2, true, "B777/787"],
  ["B78X", "Boeing", "787-10", "airplane", "jet", 2, true, "B777/787"],
  ["B744", "Boeing", "747-400", "airplane", "jet", 4, true, "B747-400"],
  ["B748", "Boeing", "747-8", "airplane", "jet", 4, true, "B747-400"],
  ["E170", "Embraer", "E170", "airplane", "jet", 2, true, "EMB-170"],
  ["E175", "Embraer", "E175", "airplane", "jet", 2, true, "EMB-170"],
  ["E190", "Embraer", "E190", "airplane", "jet", 2, true, "EMB-170"],
  ["E195", "Embraer", "E195", "airplane", "jet", 2, true, "EMB-170"],
  ["E290", "Embraer", "E190-E2", "airplane", "jet", 2, true, "EMB-170"],
  ["E295", "Embraer", "E195-E2", "airplane", "jet", 2, true, "EMB-170"],
  ["E145", "Embraer", "ERJ-145", "airplane", "jet", 2, true, "EMB-135/145"],
  ["CRJ7", "Bombardier", "CRJ700", "airplane", "jet", 2, true, "CL65"],
  ["CRJ9", "Bombardier", "CRJ900", "airplane", "jet", 2, true, "CL65"],
  ["CRJX", "Bombardier", "CRJ1000", "airplane", "jet", 2, true, "CL65"],
  // Helicopters
  ["R22", "Robinson", "R22", "helicopter", "piston", 1, false, "R22"],
  ["R44", "Robinson", "R44", "helicopter", "piston", 1, false, "R44"],
  ["R66", "Robinson", "R66", "helicopter", "turboshaft", 1, false, "R66"],
  ["G2CA", "Guimbal", "Cabri G2", "helicopter", "piston", 1, false, "Cabri G2"],
  ["AS50", "Airbus Helicopters", "H125 / AS350", "helicopter", "turboshaft", 1, false, "AS350/EC130"],
  ["EC30", "Airbus Helicopters", "H130 / EC130", "helicopter", "turboshaft", 1, false, "AS350/EC130"],
  ["EC35", "Airbus Helicopters", "H135 / EC135", "helicopter", "turboshaft", 2, false, "EC135"],
  ["EC45", "Airbus Helicopters", "H145 / EC145", "helicopter", "turboshaft", 2, false, "MBB-BK117"],
  ["A139", "Leonardo", "AW139", "helicopter", "turboshaft", 2, true, "AW139"],
  ["A169", "Leonardo", "AW169", "helicopter", "turboshaft", 2, false, "AW169"],
  ["S76", "Sikorsky", "S-76", "helicopter", "turboshaft", 2, true, "S-76"],
  // Gliders / TMG
  ["ASK21", "Schleicher", "ASK 21", "glider", "none", 0, false, "Sailplane"],
  ["DG1T", "DG Flugzeugbau", "DG-1000", "glider", "none", 0, false, "Sailplane"],
  ["DIMO", "Diamond", "HK36 Super Dimona", "tmg", "piston", 1, false, "TMG"],
  ["SF25", "Scheibe", "SF-25 Falke", "tmg", "piston", 1, false, "TMG"],
];

export const AIRCRAFT_TYPES: Omit<AircraftType, "createdAt" | "updatedAt">[] = TYPES.map(
  ([icao, manufacturer, model, category, engineType, engineCount, multiPilot, classOrTypeRating]) => ({
    id: `ref-${icao}`,
    icao,
    manufacturer,
    model,
    category,
    engineType,
    engineCount,
    multiPilot,
    classOrTypeRating,
    ownerPilotId: null,
  }),
);

/** Compact airport file produced by scripts/build-airports.mjs */
export interface AirportFile {
  source: string;
  generatedAt: string;
  fields: string[];
  rows: [string, string, string, string, string, number, number, number | null, string, number][];
}

export function expandAirports(file: AirportFile): Airport[] {
  return file.rows.map(([icao, iata, name, city, country, lat, lon, elevationFt, timezone, size]) => ({
    id: icao,
    icao,
    iata: iata || undefined,
    name,
    city: city || undefined,
    country,
    lat,
    lon,
    elevationFt: elevationFt ?? undefined,
    timezone: timezone || undefined,
    size,
  }));
}

/** Indexed airport lookup (ICAO, IATA, free text). */
export class AirportIndex {
  private byIcao = new Map<string, Airport>();
  private byIata = new Map<string, Airport>();
  constructor(public readonly list: Airport[]) {
    for (const a of list) {
      this.byIcao.set(a.icao, a);
      if (a.iata && !this.byIata.has(a.iata)) this.byIata.set(a.iata, a);
    }
  }
  add(a: Airport) {
    this.byIcao.set(a.icao, a);
    if (a.iata) this.byIata.set(a.iata, a);
    this.list.push(a);
  }
  get(code: string | undefined | null): Airport | undefined {
    if (!code) return undefined;
    const c = code.trim().toUpperCase();
    return this.byIcao.get(c) ?? (c.length === 3 ? this.byIata.get(c) : undefined);
  }
  iataToIcao = (iata: string) => this.byIata.get(iata.toUpperCase())?.icao;
  search(query: string, limit = 8): Airport[] {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const exact = this.get(q);
    const out: Airport[] = exact ? [exact] : [];
    const qn = q.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const a of this.list) {
      if (out.length >= limit) break;
      if (a === exact) continue;
      if (a.icao.startsWith(q) || a.iata === q) out.push(a);
    }
    if (out.length < limit && q.length >= 3) {
      for (const a of this.list) {
        if (out.length >= limit) break;
        if (out.includes(a)) continue;
        const hay = `${a.name} ${a.city ?? ""}`.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (hay.includes(qn)) out.push(a);
      }
    }
    return out;
  }
}
