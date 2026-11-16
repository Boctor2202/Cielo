/**
 * METAR / TAF from the Aviation Weather Center (aviationweather.gov, NOAA, public domain).
 * The raw texts are what pilots read; the decoded fields give the flight category and a one-line summary.
 */

export interface MetarCloud {
  cover: string;
  base?: number | null;
}

export interface Metar {
  icao: string;
  raw: string;
  /** observation time, ISO */
  obsTime?: string;
  wdir?: number | "VRB" | null;
  wspd?: number | null;
  wgst?: number | null;
  /** statute miles; "10+" style values become 10 */
  visibSm?: number | null;
  tempC?: number | null;
  dewpC?: number | null;
  qnhHpa?: number | null;
  clouds: MetarCloud[];
  category?: FlightCategory;
}

export interface Taf {
  icao: string;
  raw: string;
  issueTime?: string;
  validFrom?: string;
  validTo?: string;
}

export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR";

/** Lowest broken / overcast / obscured layer, feet. */
export function ceilingFt(clouds: MetarCloud[]): number | null {
  const c = clouds.filter((x) => /^(BKN|OVC|OVX|VV)$/.test(x.cover) && x.base != null).map((x) => x.base as number);
  return c.length ? Math.min(...c) : null;
}

/** FAA flight category from ceiling and visibility (the usual colour code on aviation weather maps). */
export function flightCategory(visibSm: number | null | undefined, ceiling: number | null): FlightCategory | undefined {
  if (visibSm == null && ceiling == null) return undefined;
  const v = visibSm ?? 99;
  const c = ceiling ?? 99_999;
  if (c < 500 || v < 1) return "LIFR";
  if (c < 1000 || v < 3) return "IFR";
  if (c <= 3000 || v <= 5) return "MVFR";
  return "VFR";
}

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace("+", ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const iso = (v: unknown): string | undefined => {
  if (typeof v === "number") return new Date(v * 1000).toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v.includes("T") || v.includes("Z") ? v : `${v.replace(" ", "T")}Z`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
};

/** One entry of the AWC METAR JSON. */
export function parseAwcMetar(o: Record<string, unknown>): Metar | null {
  const raw = typeof o.rawOb === "string" ? o.rawOb : "";
  const icao = typeof o.icaoId === "string" ? o.icaoId : "";
  if (!raw || !icao) return null;
  const clouds = Array.isArray(o.clouds) ? (o.clouds as Record<string, unknown>[]).map((c) => ({ cover: String(c.cover ?? ""), base: num(c.base) })) : [];
  const visibSm = num(o.visib);
  const fc = typeof o.fltCat === "string" && /^(VFR|MVFR|IFR|LIFR)$/.test(o.fltCat) ? (o.fltCat as FlightCategory) : flightCategory(visibSm, ceilingFt(clouds));
  return {
    icao,
    raw,
    obsTime: iso(o.obsTime ?? o.reportTime),
    wdir: o.wdir === "VRB" ? "VRB" : num(o.wdir),
    wspd: num(o.wspd),
    wgst: num(o.wgst),
    visibSm,
    tempC: num(o.temp),
    dewpC: num(o.dewp),
    qnhHpa: num(o.altim),
    clouds,
    category: fc,
  };
}

/** One entry of the AWC TAF JSON. */
export function parseAwcTaf(o: Record<string, unknown>): Taf | null {
  const raw = typeof o.rawTAF === "string" ? o.rawTAF : "";
  const icao = typeof o.icaoId === "string" ? o.icaoId : "";
  if (!raw || !icao) return null;
  return { icao, raw, issueTime: iso(o.issueTime), validFrom: iso(o.validTimeFrom), validTo: iso(o.validTimeTo) };
}

/** "270° 12 kt G22", "VRB 3 kt", "calm". */
export function windText(m: Pick<Metar, "wdir" | "wspd" | "wgst">, calm = "calm"): string {
  if (m.wspd == null) return "—";
  if (m.wspd === 0) return calm;
  const dir = m.wdir === "VRB" ? "VRB" : m.wdir != null ? `${String(Math.round(m.wdir)).padStart(3, "0")}°` : "";
  return `${dir} ${m.wspd} kt${m.wgst ? ` G${m.wgst}` : ""}`.trim();
}

/** Visibility in metres or km, as read in Europe ("9999" → "≥ 10 km"). */
export function visibilityText(sm: number | null | undefined): string {
  if (sm == null) return "—";
  const m = sm * 1609.34;
  if (sm >= 6) return "≥ 10 km";
  return m >= 5000 ? `${Math.round(m / 1000)} km` : `${Math.round(m / 100) * 100} m`;
}

/** TAF raw text split before each change group, for display one period per line. */
export function tafLines(raw: string): string[] {
  const parts = raw
    .replace(/\s+/g, " ")
    .split(/ (?=(?:BECMG|TEMPO|FM\d{6}|PROB\d{2})\b)/)
    .map((s) => s.trim())
    .filter(Boolean);
  // "PROB30" followed by "TEMPO …" is one group
  const out: string[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && /^PROB\d{2}$/.test(last)) out[out.length - 1] = `${last} ${p}`;
    else out.push(p);
  }
  return out;
}

/** Minutes since the observation. */
export const ageMin = (isoTime: string | undefined, now = Date.now()) => (isoTime ? Math.max(0, Math.round((now - Date.parse(isoTime)) / 60000)) : null);

/** One runway end: designator and true heading (OurAirports). */
export interface RunwayEnd {
  ident: string;
  headingTrue: number;
  lengthFt: number;
}

/** The runway the wind favours: the end with the most headwind (longest one on a tie). */
export interface RunwayChoice {
  ident: string;
  headwindKt: number;
  /** absolute crosswind component */
  crosswindKt: number;
  /** wind under 4 kt or variable: no runway is favoured, the aerodrome uses its preferential one */
  calm?: false;
}
export type RunwayEstimate = RunwayChoice | { calm: true };

/**
 * Estimated runway in use from the METAR wind. This is what the wind favours, not the runway the ATIS
 * announces: noise abatement, preferential runways or works can make the tower choose otherwise.
 */
export function favouredRunway(m: Pick<Metar, "wdir" | "wspd">, ends: RunwayEnd[]): RunwayEstimate | null {
  if (!ends.length || m.wspd == null) return null;
  if (m.wspd < 4 || m.wdir === "VRB" || m.wdir == null) return { calm: true };
  const dir = m.wdir;
  let best: (RunwayChoice & { len: number }) | null = null;
  for (const e of ends) {
    const a = ((dir - e.headingTrue) * Math.PI) / 180;
    const head = m.wspd * Math.cos(a);
    const cross = Math.abs(m.wspd * Math.sin(a));
    if (!best || head > best.headwindKt + 0.5 || (Math.abs(head - best.headwindKt) <= 0.5 && e.lengthFt > best.len)) {
      best = { ident: e.ident, headwindKt: head, crosswindKt: cross, len: e.lengthFt };
    }
  }
  if (!best) return null;
  return { ident: best.ident, headwindKt: Math.round(best.headwindKt), crosswindKt: Math.round(best.crosswindKt) };
}
