const RAD = Math.PI / 180;
const EARTH_RADIUS_NM = 3440.065;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Great-circle distance in nautical miles. */
export function distanceNm(a: LatLon, b: LatLon): number {
  return centralAngle(a, b) * EARTH_RADIUS_NM;
}

function centralAngle(a: LatLon, b: LatLon): number {
  const φ1 = a.lat * RAD;
  const φ2 = b.lat * RAD;
  const dφ = φ2 - φ1;
  const dλ = (b.lon - a.lon) * RAD;
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at fraction f (0..1) along the great circle from a to b. */
export function interpolateGreatCircle(a: LatLon, b: LatLon, f: number): LatLon {
  const δ = centralAngle(a, b);
  if (δ < 1e-9) return { lat: a.lat, lon: a.lon };
  const φ1 = a.lat * RAD;
  const λ1 = a.lon * RAD;
  const φ2 = b.lat * RAD;
  const λ2 = b.lon * RAD;
  const A = Math.sin((1 - f) * δ) / Math.sin(δ);
  const B = Math.sin(f * δ) / Math.sin(δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD, lon: Math.atan2(y, x) / RAD };
}

/** Sample points along a great circle, for drawing routes on a map. */
export function greatCirclePath(a: LatLon, b: LatLon, segments = 32): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const p = interpolateGreatCircle(a, b, i / segments);
    out.push([p.lon, p.lat]);
  }
  return out;
}
