import type { Tier } from "@cielo/core";

/** The metals (light and dark ends of their gradient), shared with the app: bronze to legend. */
export { TIER_COLORS } from "@cielo/core";
import { TIER_COLORS } from "@cielo/core";

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

