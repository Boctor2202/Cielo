import { BadgeCheck, Compass, Earth, Globe2, Moon, MoonStar, Plane, PlaneLanding, Rocket, Route, type LucideIcon } from "lucide-react";
import type { DiscoveryId, DiscoverySeries, Tier } from "@cielo/core";

/** The metals, light and dark ends of their gradient: bronze to legend. */
export const TIER_COLORS: Record<Tier, [string, string]> = {
  bronze: ["#F0B37E", "#8A4B1F"],
  silver: ["#F1F5F9", "#7B8794"],
  gold: ["#FDE68A", "#B7791F"],
  platinum: ["#CFFAFE", "#3B82B8"],
  diamond: ["#E9D5FF", "#7C3AED"],
  legend: ["#FDA4AF", "#9F1239"],
};

/** Each series' symbol (lucide), and its name in the icon set for the server images. */
const SERIES: Record<DiscoverySeries, { icon: LucideIcon; svg: string }> = {
  night: { icon: Moon, svg: "moon" },
  nightLandings: { icon: MoonStar, svg: "moon-star" },
  landings: { icon: PlaneLanding, svg: "plane-landing" },
  airports: { icon: Compass, svg: "compass" },
  countries: { icon: Globe2, svg: "globe" },
  distance: { icon: Earth, svg: "earth" },
  longest: { icon: Route, svg: "route" },
  types: { icon: Plane, svg: "plane" },
  signed: { icon: BadgeCheck, svg: "badge-check" },
};
const MOON = new Set<DiscoveryId>(["toTheMoon", "moonAndBack"]);
export const iconFor = (id: DiscoveryId, series: DiscoverySeries): LucideIcon => (MOON.has(id) ? Rocket : SERIES[series].icon);

/** The symbols as SVG markup (lucide, 24×24, stroked), for the share images drawn on the server. */
const ICON_SVG: Record<string, string> = {
  "moon": "<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>",
  "moon-star": "<path d=\"M18 5h4\"/><path d=\"M20 3v4\"/><path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>",
  "plane-landing": "<path d=\"M2 22h20\"/><path d=\"M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z\"/>",
  "compass": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/>",
  "earth": "<path d=\"M21.54 15H17a2 2 0 0 0-2 2v4.54\"/><path d=\"M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17\"/><path d=\"M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
  "rocket": "<path d=\"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5\"/><path d=\"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09\"/><path d=\"M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z\"/><path d=\"M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05\"/>",
  "route": "<circle cx=\"6\" cy=\"19\" r=\"3\"/><path d=\"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15\"/><circle cx=\"18\" cy=\"5\" r=\"3\"/>",
  "plane": "<path d=\"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z\"/>",
  "badge-check": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\"/><path d=\"m16 9-5.5 5.5L8 12\"/>"
};
export const iconSvgFor = (id: DiscoveryId, series: DiscoverySeries) => ICON_SVG[MOON.has(id) ? "rocket" : SERIES[series].svg]!;

/** The stars under the symbol: one per rank in a series (none for a single badge). */
export const starsOf = (rank: number, of: number) => (of > 1 ? rank : 0);
export const starPath = (cx: number) => `M${cx} 47 l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z`;
export const starX = (i: number, n: number) => 32 + (i - (n - 1) / 2) * 7.2;

/** The hexagonal emblem as an SVG document; `icon` is the symbol's SVG markup. */
export function emblemSvg(tier: Tier, stars: number, icon: string): string {
  const [from, to] = TIER_COLORS[tier];
  const st = Array.from({ length: stars }, (_, i) => `<path d="${starPath(starX(i, stars))}" fill="#FFF7D6" transform="translate(${starX(i, stars)} 50) scale(.85) translate(${-starX(i, stars)} -50)"/>`).join("");
  const iconY = stars ? 14 : 19;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 68" width="640" height="680">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<path d="M32 2 L59 17.5 V50.5 L32 66 L5 50.5 V17.5 Z" fill="url(#g)" stroke="rgba(255,255,255,.6)" stroke-width="1.5"/>
<path d="M32 8 L54 20.7 V47.3 L32 60 L10 47.3 V20.7 Z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
<path d="M5 17.5 L32 2 L59 17.5 V30 C44 24 20 24 5 30 Z" fill="url(#s)"/>
${st}
<svg x="19" y="${iconY}" width="26" height="26" viewBox="0 0 24 24"><g fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</g></svg>
</svg>`;
}

/** The round hour medal as an SVG document. */
export function medalSvg(hours: number, tier: Tier, withLabel = true): string {
  const [a, b] = TIER_COLORS[tier];
  const label = hours >= 1000 ? `${hours / 1000}k` : String(hours);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="560" height="560">
<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<circle cx="28" cy="28" r="26" fill="url(#m)"/>
<circle cx="28" cy="28" r="21" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.2" stroke-dasharray="2 2.5"/>
<path d="M28 17c-2 0-3 1.4-3 1.4H13.5c1 1.8 3 2.6 5 2.6h6.3s1.2 1 3.2 1 3.2-1 3.2-1h6.3c2 0 4-.8 5-2.6H31S30 17 28 17z" fill="rgba(10,22,38,.55)"/>
${withLabel ? `<text x="28" y="38" text-anchor="middle" font-size="${hours >= 10000 ? 10 : 12}" font-weight="800" font-family="Inter" fill="rgba(10,22,38,.8)">${label}</text>` : ""}
</svg>`;
}

/** The shoulder board with 2–4 stripes. */
export function epauletteSvg(stripes: 2 | 3 | 4): string {
  const H = 22, gap = 5.5, bar = 3.4, W = 14 + stripes * gap + 4;
  const bars = Array.from({ length: stripes }, (_, i) => `<rect x="${14 + i * gap}" y="3" width="${bar}" height="${H - 6}" rx="0.6" fill="url(#gd)"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 4}" height="${H * 4}">
<defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6D77A"/><stop offset=".5" stop-color="#D4A93A"/><stop offset="1" stop-color="#A97C1E"/></linearGradient>
<linearGradient id="nv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2C47"/><stop offset="1" stop-color="#0B1526"/></linearGradient></defs>
<path d="M0 ${H / 2} L8 1 H${W - 3} Q${W - 1} 1 ${W - 1} 3 V${H - 3} Q${W - 1} ${H - 1} ${W - 3} ${H - 1} H8 Z" fill="url(#nv)" stroke="rgba(255,255,255,.25)"/>${bars}
</svg>`;
}

