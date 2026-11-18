import { BadgeCheck, Compass, Earth, Globe2, Map, Moon, MoonStar, Plane, Stamp, type LucideIcon } from "lucide-react";
import type { DiscoveryId, Tier } from "@cielo/core";

/** The look of each badge, shared by the Statistics page and the share images. */
export const DISCOVERY_LOOK: Record<DiscoveryId, { icon: LucideIcon; from: string; to: string; stars?: number }> = {
  firstNight: { icon: Moon, from: "#A5B4FC", to: "#3730A3" },
  nightLandings100: { icon: MoonStar, from: "#C4B5FD", to: "#4C1D95" },
  airports10: { icon: Compass, from: "#7DD3FC", to: "#0369A1", stars: 1 },
  airports50: { icon: Compass, from: "#67E8F9", to: "#0E7490", stars: 2 },
  airports100: { icon: Map, from: "#5EEAD4", to: "#115E59", stars: 3 },
  countries5: { icon: Stamp, from: "#FCD34D", to: "#B45309", stars: 1 },
  countries10: { icon: Globe2, from: "#FDBA74", to: "#C2410C", stars: 2 },
  countries25: { icon: Globe2, from: "#FCA5A5", to: "#B91C1C", stars: 3 },
  earthLap: { icon: Earth, from: "#86EFAC", to: "#15803D" },
  types3: { icon: Plane, from: "#F9A8D4", to: "#9D174D" },
  firstSigned: { icon: BadgeCheck, from: "#F0ABFC", to: "#86198F" },
};

export const TIER_COLORS: Record<Tier, [string, string]> = {
  bronze: ["#E7A46B", "#9A5B2C"],
  silver: ["#E6EBF2", "#8C99AB"],
  gold: ["#F6D77A", "#B8871F"],
  platinum: ["#C7F0FF", "#5B8DB8"],
};

/** The hexagonal emblem as an SVG document; `icon` is the symbol's SVG markup (white). */
export function emblemSvg(id: DiscoveryId, icon: string): string {
  const l = DISCOVERY_LOOK[id];
  const stars = Array.from({ length: l.stars ?? 0 }, (_, i) => {
    const cx = 32 + (i - ((l.stars ?? 1) - 1) / 2) * 8;
    return `<path d="M${cx} 47 l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#FFF7D6"/>`;
  }).join("");
  const iconY = l.stars ? 14 : 19;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 68" width="640" height="680">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${l.from}"/><stop offset="1" stop-color="${l.to}"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<path d="M32 2 L59 17.5 V50.5 L32 66 L5 50.5 V17.5 Z" fill="url(#g)" stroke="rgba(255,255,255,.6)" stroke-width="1.5"/>
<path d="M32 8 L54 20.7 V47.3 L32 60 L10 47.3 V20.7 Z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
<path d="M5 17.5 L32 2 L59 17.5 V30 C44 24 20 24 5 30 Z" fill="url(#s)"/>
${stars}
<svg x="19" y="${iconY}" width="26" height="26" viewBox="0 0 24 24">${icon}</svg>
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

/** The badges' symbols as SVG markup (lucide, 24×24, stroked), for the share images drawn on the server. */
export const DISCOVERY_ICON_SVG: Record<DiscoveryId, string> = {
  "firstNight": "<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>",
  "nightLandings100": "<path d=\"M18 5h4\"/><path d=\"M20 3v4\"/><path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>",
  "airports10": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/>",
  "airports50": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/>",
  "airports100": "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\"/><path d=\"M15 5.764v15\"/><path d=\"M9 3.236v15\"/>",
  "countries5": "<path d=\"M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13\"/><path d=\"M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z\"/><path d=\"M5 22h14\"/>",
  "countries10": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/>",
  "countries25": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/>",
  "earthLap": "<path d=\"M21.54 15H17a2 2 0 0 0-2 2v4.54\"/><path d=\"M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17\"/><path d=\"M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
  "types3": "<path d=\"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z\"/>",
  "firstSigned": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\"/><path d=\"m16 9-5.5 5.5L8 12\"/>"
};
