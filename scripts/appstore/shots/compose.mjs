// App Store screenshots: each raw capture of the app, in a phone frame, under a headline, on Geardown's sky.
// Run: node scripts/appstore/shots/compose.mjs  →  scripts/appstore/shots/out/<locale>/<n>.png (1290 × 2796, 6.9")
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const font = (p) => readFileSync(join(root, "node_modules/.pnpm", p)).toString("base64");
const MANROPE = font("@fontsource-variable+manrope@5.3.0/node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2");
const SKY = readFileSync(join(root, "apps/mobile/assets/backdrop.jpg")).toString("base64");
const SHOTS = JSON.parse(readFileSync(join(here, "shots.json"), "utf8"));
const W = 1290, H = 2796;

const page = (shot, t) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${MANROPE}) format("woff2");font-weight:200 800}
*{margin:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:Manrope,sans-serif;color:#fff;
 background:linear-gradient(180deg,rgba(6,12,24,.94) 0%,rgba(6,12,24,.72) 34%,rgba(6,12,24,.35) 62%,rgba(6,12,24,.85) 100%),url(data:image/jpeg;base64,${SKY}) center/cover}
.top{position:absolute;top:150px;left:110px;right:110px}
.brand{display:inline-flex;align-items:baseline;font-weight:700;letter-spacing:.18em;font-size:46px;line-height:1;color:#fff}
.brand .r{font-weight:400}
.brand svg{position:relative;top:.29em;margin-right:.18em;width:1.3em;height:1.3em;flex-shrink:0}
h1{margin-top:64px;font-size:112px;line-height:1.04;font-weight:800;letter-spacing:-.02em}
h1 em{font-style:normal;color:#22c55e}
p{margin-top:36px;font-size:46px;line-height:1.35;color:rgba(255,255,255,.72);font-weight:500;max-width:1000px}
.phone{position:absolute;left:50%;bottom:-120px;transform:translateX(-50%);width:1010px;padding:22px;border-radius:120px;
 background:linear-gradient(160deg,#2a3346,#0b1220);box-shadow:0 60px 140px rgba(0,0,0,.6),0 0 0 3px rgba(255,255,255,.12) inset}
.phone img{display:block;width:100%;border-radius:98px}
.glow{position:absolute;left:50%;bottom:600px;width:1100px;height:700px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(34,197,94,.28),transparent);filter:blur(20px)}
</style></head><body>
<div class="glow"></div>
<div class="top"><div class="brand" aria-label="Geardown"><span>GEAR</span><span class="r">D</span><svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="17.3" stroke="currentColor" stroke-width="3.4"/><circle cx="20" cy="13.4" r="4.6" fill="#22C55E"/><circle cx="14" cy="23.8" r="4.6" fill="#22C55E"/><circle cx="26" cy="23.8" r="4.6" fill="#22C55E"/></svg><span class="r">WN</span></div>
<h1>${t.title}</h1><p>${t.text}</p></div>
<div class="phone"><img src="data:image/jpeg;base64,${shot}"></div>
</body></html>`;

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const [i, s] of SHOTS.entries()) {
  for (const locale of ["fr", "en"]) {
    const file = join(here, "raw", s.file[locale] ?? s.file.fr);
    if (!existsSync(file)) { console.log(`skip ${s.file[locale] ?? s.file.fr}`); continue; }
    const out = join(here, "out", locale);
    mkdirSync(out, { recursive: true });
    await tab.setContent(page(readFileSync(file).toString("base64"), s[locale]), { waitUntil: "load" });
    await tab.screenshot({ path: join(out, `${i + 1}.png`) });
    console.log(`${locale}/${i + 1}.png`);
  }
}
await browser.close();
