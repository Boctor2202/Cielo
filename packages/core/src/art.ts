/**
 * Pilot wings for the hour levels, as an SVG document shared by the website, the app and the share images:
 * a round badge in the middle and feathered wings on each side, in the level's metal.
 */
export function wingsSvg(opts: { from: string; to: string; label?: string; id?: string; locked?: boolean }): string {
  const { from, to, label, locked } = opts;
  const id = (opts.id ?? "w").replace(/[^a-zA-Z0-9_-]/g, "");
  const a = locked ? "#3A4658" : from;
  const b = locked ? "#1E2836" : to;
  const edge = locked ? "rgba(255,255,255,.10)" : "rgba(10,22,38,.35)";
  // six feathers per wing, longest at the top, each a tapered blade
  const feathers: string[] = [];
  for (let k = 0; k < 6; k++) {
    // the feathers sweep up towards the tips, the top one longest
    const y = 17 + k * 4.4;
    const tip = 2 + k * 7.8;
    const ty = y - 9 + k * 1.6;
    const t = 3.1 - k * 0.22;
    const left = `M49 ${(y - t).toFixed(2)} C37 ${(y - t - 2).toFixed(2)} 20 ${(ty - 1).toFixed(2)} ${tip.toFixed(2)} ${ty.toFixed(2)} C20 ${(ty + 4).toFixed(2)} 36 ${(y + t + 1).toFixed(2)} 49 ${(y + t).toFixed(2)}Z`;
    const mirror = left.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, yy) => `${(120 - Number(x)).toFixed(2)} ${yy}`);
    feathers.unshift(left, mirror);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 56">
<defs>
<linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${locked ? 0.06 : 0.5}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
${feathers.map((d) => `<path d="${d}" fill="url(#${id}m)" stroke="${edge}" stroke-width=".6"/>`).join("")}
<circle cx="60" cy="27" r="17" fill="url(#${id}c)" stroke="${locked ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.7)"}" stroke-width="1.4"/>
<circle cx="60" cy="27" r="13.2" fill="none" stroke="${locked ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.45)"}" stroke-width=".8" stroke-dasharray="1.6 1.8"/>
<path d="M43.5 24 A17 17 0 0 1 76.5 24 Q60 19 43.5 24Z" fill="url(#${id}s)"/>
${label ? `<text x="60" y="${label.length > 3 ? 30.5 : 31.5}" text-anchor="middle" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="${label.length > 3 ? 9 : 11}" font-weight="800" fill="${locked ? "rgba(255,255,255,.35)" : "rgba(10,22,38,.82)"}">${label}</text>` : ""}
</svg>`;
}

/** The figure printed on a level's wings: 500, 1k, 1.5k… */
export const hoursLabel = (hours: number) => (hours >= 1000 ? `${hours / 1000}k` : String(hours));
