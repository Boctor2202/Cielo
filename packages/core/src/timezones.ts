/**
 * The world time-zone map, shared by the website and the app: the zone at a point (from the 1° grid built by
 * scripts/timezones/build.mjs), the UTC offset of a zone right now, and the night side of the Earth.
 */
export interface TimezoneMapData {
  north: number;
  south: number;
  zones: string[];
  /** base64 Uint16 little-endian, 360 columns × (north − south) rows, the zone index at each 1° cell */
  grid: string;
  /** coastline, SVG path in a 360 × (north − south) box */
  land: string;
  attribution: string;
}

function decode(b64: string): Uint16Array {
  const bin = atob(b64);
  const out = new Uint16Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
  return out;
}

export function timezoneMap(data: TimezoneMapData) {
  let grid: Uint16Array | null = null;
  const span = data.north - data.south;
  return {
    ...data,
    span,
    /** the IANA zone at a point (1° precision) */
    zoneAt(lat: number, lon: number): string | undefined {
      grid ??= decode(data.grid);
      const y = Math.floor(data.north - lat);
      const x = Math.floor(((lon + 180) % 360 + 360) % 360);
      if (y < 0 || y >= span) return undefined;
      return data.zones[grid[y * 360 + x] ?? 0];
    },
    /** map coordinates (0..360, 0..span) of a point */
    xy: (lat: number, lon: number) => ({ x: lon + 180, y: data.north - lat }),
  };
}

/** UTC offset of a zone at an instant, in minutes (summer time included). */
export function zoneOffsetMin(zone: string, at: Date = new Date()): number {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = part.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  } catch {
    return 0;
  }
}

export const formatOffset = (min: number) =>
  `UTC${min >= 0 ? "+" : "−"}${Math.floor(Math.abs(min) / 60)}${Math.abs(min) % 60 ? `:${String(Math.abs(min) % 60).padStart(2, "0")}` : ""}`;

/** "14:05" in a zone (or UTC). */
export function clockIn(zone: string | undefined, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, ...(zone ? { timeZone: zone } : {}) }).format(at);
  } catch {
    return "--:--";
  }
}

/**
 * The night side as an SVG path in the map box (x = lon + 180, y = north − lat): the area where the sun is below
 * the horizon, from the sun's declination and the longitude where it stands overhead.
 */
export function nightPath(at: Date, north: number, south: number): string {
  const day = (Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) - Date.UTC(at.getUTCFullYear(), 0, 0)) / 86_400_000;
  const decl = (-23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10)) * Math.PI) / 180;
  const hours = at.getUTCHours() + at.getUTCMinutes() / 60;
  const sunLon = (12 - hours) * 15;
  const rad = Math.PI / 180;
  const pts: string[] = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    const ha = (lon - sunLon) * rad;
    // the terminator: tan(lat) = −cos(hour angle) / tan(declination)
    let lat = Math.atan(-Math.cos(ha) / Math.tan(decl === 0 ? 1e-6 : decl)) / rad;
    lat = Math.max(south, Math.min(north, lat));
    pts.push(`${(lon + 180).toFixed(1)} ${(north - lat).toFixed(2)}`);
  }
  // night is on the side of the pole that has no sun: south in the northern summer (declination > 0)
  const edge = decl > 0 ? (north - south).toFixed(1) : "0";
  return `M0 ${edge}L${pts.join("L")}L360 ${edge}Z`;
}
