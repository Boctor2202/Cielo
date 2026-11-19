import type { DiscoveryId, DiscoverySeries, Tier } from "./achievements";

/**
 * The discovery badges, drawn once for the website, the app and the share images: each series has its own
 * outline and its own symbol, in the metal of its rank, with one star per rank.
 */

/** The metals, light and dark ends of their gradient: bronze to legend. */
export const TIER_COLORS: Record<Tier, [string, string]> = {
  bronze: ["#F0B37E", "#8A4B1F"],
  silver: ["#F1F5F9", "#7B8794"],
  gold: ["#FDE68A", "#B7791F"],
  platinum: ["#CFFAFE", "#3B82B8"],
  diamond: ["#E9D5FF", "#7C3AED"],
  legend: ["#FDA4AF", "#9F1239"],
};

const CX = 32;
const CY = 34;
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")} Z`;
const around = (n: number, r: (i: number) => number, turn = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((i / n) * 2 + turn) * Math.PI - Math.PI / 2;
    return [CX + Math.cos(a) * r(i), CY + Math.sin(a) * r(i)] as [number, number];
  });

/** One outline per series, in a 64 × 68 box. */
const FRAME: Record<DiscoverySeries, string> = {
  // a heraldic shield
  night: "M32 3 L58 11 V33 C58 50 46 61 32 66 C18 61 6 50 6 33 V11 Z",
  // a round medal
  nightLandings: "M32 4 A30 30 0 1 1 31.99 4 Z",
  // the hexagon
  landings: "M32 2 L59 17.5 V50.5 L32 66 L5 50.5 V17.5 Z",
  // an octagon, like a sign at the gate
  airports: poly(around(8, () => 31, 1 / 8)),
  // a diamond
  countries: "M32 2 L62 34 L32 66 L2 34 Z",
  // a sun with sixteen rays
  distance: poly(around(32, (i) => (i % 2 ? 27 : 31.5))),
  // a pennant
  longest: "M10 3 H54 A6 6 0 0 1 60 9 V50 L32 66 L4 50 V9 A6 6 0 0 1 10 3 Z",
  // a rounded square
  types: "M32 3 C55 3 61 9 61 34 C61 59 55 65 32 65 C9 65 3 59 3 34 C3 9 9 3 32 3 Z",
  // a wax seal
  signed: poly(around(48, (i) => 29.5 + Math.cos((i / 48) * 12 * 2 * Math.PI) * 1.8)),
};

/** The symbols (24 × 24, stroked; lucide's where one fits, ISC licence), placed with a transform: a nested <svg>
 * is not positioned by the app's SVG renderer on iOS. */
const GLYPH: Record<DiscoverySeries | "rocket", string> = {
  night: '<path d="M18 5h4"/><path d="M20 3v4"/><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
  // a runway at night: its edges, centre line and a crescent
  nightLandings: '<path d="M6 22 9.5 10"/><path d="M18 22 14.5 10"/><path d="M12 21v-2"/><path d="M12 16.5v-1.5"/><path d="M12 12.8v-1"/><path d="M18.6 2.2a3.4 3.4 0 1 0 3.1 5.1 2.7 2.7 0 0 1-3.1-5.1z"/><path d="M4 7.5h2"/><path d="M5 6.5v2"/>',
  landings: '<path d="M2 22h20"/><path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z"/>',
  airports: '<path d="M18.2 12.27 20 6H4l1.8 6.27a1 1 0 0 0 .95.73h10.5a1 1 0 0 0 .96-.73Z"/><path d="M8 13v9"/><path d="M16 22v-9"/><path d="m9 6 1 7"/><path d="m15 6-1 7"/><path d="M12 6V2"/><path d="M13 2h-2"/>',
  countries: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  distance: '<path d="M20.341 6.484A10 10 0 0 1 10.266 21.85"/><path d="M3.659 17.516A10 10 0 0 1 13.74 2.152"/><circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/>',
  longest: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  types: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  signed: '<path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/><path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z"/><path d="M5 22h14"/>',
  rocket: '<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/>',
};

const MOON = new Set<DiscoveryId>(["toTheMoon", "moonAndBack"]);
export const glyphFor = (id: DiscoveryId, series: DiscoverySeries) => GLYPH[MOON.has(id) ? "rocket" : series];

/** The stars under the symbol: one per rank in a series (none for a single badge). */
export const starsOf = (rank: number, of: number) => (of > 1 ? rank : 0);
const star = (cx: number, cy: number, r: number) =>
  poly(Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * 2 * Math.PI - Math.PI / 2;
    const k = i % 2 ? r * 0.45 : r;
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k] as [number, number];
  }));

/**
 * A discovery badge as an SVG document (64 × 68 view box).
 * @param key makes the gradient ids unique when several badges share one document
 */
export function badgeEmblemSvg(o: { series: DiscoverySeries; id: DiscoveryId; tier: Tier; rank: number; of: number; locked?: boolean; size?: number; key?: string }): string {
  const [from, to] = o.locked ? ["#3B4657", "#151C27"] : TIER_COLORS[o.tier];
  const k = o.key ?? `${o.id}${o.locked ? "l" : ""}`;
  const frame = FRAME[o.series];
  const n = o.locked ? 0 : starsOf(o.rank, o.of);
  const size = o.size ?? 640;
  // a series of ranks: the outline is drawn a little smaller, and its stars sit in a row above it, as on a champion's jersey, in the badge's metal with a dark rim
  const gap = 8.6;
  const stars = Array.from({ length: n }, (_, i) => {
    const off = i - (n - 1) / 2;
    return star(CX + off * gap, 5.2 + off * off * 0.35, 3.9);
  })
    .map((d) => `<path d="${d}" fill="url(#${k}t)" stroke="${to}" stroke-width="1" stroke-linejoin="round"/>`)
    .join("");
  const gy = 34;
  const glyph = glyphFor(o.id, o.series);
  const ink = o.locked ? "rgba(255,255,255,.3)" : "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 68" width="${size}" height="${(size * 68) / 64}">
<defs>
<linearGradient id="${k}g" x1="0" y1="0" x2=".55" y2="1"><stop offset="0" stop-color="${from}"/><stop offset=".55" stop-color="${to}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<linearGradient id="${k}d" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${o.locked ? 0 : 0.22}"/></linearGradient>
<linearGradient id="${k}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${from}"/><stop offset="1" stop-color="${from}"/></linearGradient>
<radialGradient id="${k}r" cx=".32" cy=".22" r=".75"><stop offset="0" stop-color="#fff" stop-opacity="${o.locked ? 0.06 : 0.42}"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient>
<clipPath id="${k}c"><path d="${frame}"/></clipPath>
</defs>
<g transform="${o.of > 1 ? "translate(4.8 10.4) scale(.85)" : ""}">
<path d="${frame}" fill="url(#${k}g)"/>
<g clip-path="url(#${k}c)"><path d="${frame}" fill="url(#${k}r)"/><rect x="0" y="0" width="64" height="68" fill="url(#${k}d)"/></g>
<path d="${frame}" fill="none" stroke="rgba(255,255,255,${o.locked ? 0.14 : 0.7})" stroke-width="1.6" stroke-linejoin="round"/>
<path d="${frame}" fill="none" stroke="rgba(255,255,255,${o.locked ? 0.12 : 0.32})" stroke-width="1.1" stroke-linejoin="round" ${o.locked ? 'stroke-dasharray="2 3"' : ""} transform="translate(${CX} ${CY}) scale(.82) translate(${-CX} ${-CY})"/>
${o.locked ? "" : `<g transform="translate(${CX - 12.5} ${gy - 12.5 + 1}) scale(${25 / 24})" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`}
<g transform="translate(${CX - 12.5} ${gy - 12.5}) scale(${25 / 24})" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</g>
${stars}
</svg>`;
}
