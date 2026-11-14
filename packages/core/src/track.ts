import type { TrackPoint } from "./types";

/**
 * Picks, among the legs of an aircraft's recorded track, the one that matches a logged flight
 * (block-off → block-on in UTC) and trims it to that window. Returns null when no leg overlaps.
 */
export function pickLeg(legs: TrackPoint[][], outUtc: string, inUtc: string, marginMin = 20): TrackPoint[] | null {
  const from = Date.parse(outUtc) / 1000 - marginMin * 60;
  const to = Date.parse(inUtc) / 1000 + marginMin * 60;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  let best: TrackPoint[] | null = null;
  let bestOverlap = 0;
  for (const leg of legs) {
    if (leg.length < 2) continue;
    const a = leg[0]![0];
    const b = leg[leg.length - 1]![0];
    const overlap = Math.min(b, to) - Math.max(a, from);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = leg;
    }
  }
  if (!best) return null;
  const trimmed = best.filter((p) => p[0] >= from && p[0] <= to);
  // the matching leg must cover at least half of the logged block time
  return trimmed.length >= 2 && bestOverlap >= (to - from - 2 * marginMin * 60) / 2 ? trimmed : null;
}

/**
 * Douglas–Peucker simplification on lat/lon (tolerance in degrees, ~0.002° ≈ 200 m), then capped to
 * `max` points. The first and last points and every altitude turning point above `altStepFt` are kept,
 * so the altitude profile stays faithful.
 */
export function simplifyTrack(points: TrackPoint[], tolerance = 0.002, max = 400, altStepFt = 1000): TrackPoint[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const [, y1, x1] = points[i]!;
    const [, y2, x2] = points[j]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-12;
    let dmax = 0;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const [, y, x] = points[k]!;
      const d = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
      if (d > dmax) {
        dmax = d;
        idx = k;
      }
    }
    if (idx > 0 && dmax > tolerance) {
      keep[idx] = 1;
      stack.push([i, idx], [idx, j]);
    }
  }
  // altitude: keep a point every time the altitude moved by altStepFt since the last kept one
  let lastAlt = points[0]![3] ?? 0;
  for (let k = 1; k < points.length - 1; k++) {
    const alt = points[k]![3] ?? 0;
    if (Math.abs(alt - lastAlt) >= altStepFt) {
      keep[k] = 1;
      lastAlt = alt;
    }
  }
  let out = points.filter((_, k) => keep[k]);
  if (out.length > max) {
    const step = out.length / max;
    const thinned: TrackPoint[] = [];
    for (let k = 0; k < max - 1; k++) thinned.push(out[Math.floor(k * step)]!);
    thinned.push(out[out.length - 1]!);
    out = thinned;
  }
  return out;
}
