// Generates the marketing screenshots from the real app with demo data.
// Usage: start the app (pnpm dev or pnpm start), then: node scripts/screenshots.mjs [baseUrl]
// Output: public/screens/{light,dark}/<name>.png
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// Uses the project's playwright if installed, otherwise the globally installed one.
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
}
const { chromium } = pw;

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = path.resolve("public/screens");
const SAMPLE_CSV = [
  "Date;Départ;Arrivée;Off block;On block;Immatriculation;Type;Fonction;Nuit;Remarques",
  "02/10/2026;LFPN;LFOP;09:10;10:25;F-GSTR;DR40;PIC;;Navigation",
  "02/10/2026;LFOP;LFPN;11:00;12:20;F-GSTR;DR40;PIC;;",
  "02/10/2026;LFOP;LFPN;11:00;12:20;F-GSTR;DR40;PIC;;Doublon",
  "03/10/2026;LFPN;LFRK;14:00;13:30;F-GSTR;DR40;PIC;2:00;Heures inversées",
].join("\n");

async function shoot(theme) {
  const dir = path.join(OUT, theme);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, colorScheme: theme, locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.addInitScript((t) => localStorage.setItem("cielo-theme", t), theme);
  const page = await ctx.newPage();
  const go = async (p, wait = 1500) => {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(wait);
  };
  const snap = (name) => page.screenshot({ path: path.join(dir, `${name}.png`) });

  await go("/fr/connexion?demo=1", 500);
  await page.getByRole("button", { name: /démonstration/ }).first().click();
  await page.waitForURL("**/fr/app", { timeout: 90_000 });
  await page.waitForTimeout(2500);

  await go("/fr/app", 2000);
  await snap("dashboard");
  await go("/fr/app/carnet");
  await snap("logbook");

  // Import: show column mapping + preview, then import (feeds the audit screenshot)
  await go("/fr/app/carnet/import");
  const tmp = path.join(OUT, "_sample.csv");
  fs.writeFileSync(tmp, SAMPLE_CSV);
  await page.setInputFiles('input[type="file"]', tmp);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(300);
  await snap("import");
  await page.getByRole("button", { name: /Importer \d/ }).click();
  await page.waitForTimeout(1200);
  fs.rmSync(tmp);

  await go("/fr/app/carnet/audit");
  await snap("audit");
  await go("/fr/app/documents");
  await snap("licenses");
  await go("/fr/app/ftl");
  await snap("ftl");
  await go("/fr/app/carte", 5000);
  await snap("stats");
  await go("/fr/app/roster");
  await snap("roster");

  // Signature: open the latest flight and draw
  await go("/fr/app/carnet");
  await page.locator("tbody tr").first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Faire signer/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("dialog").locator("input").first().fill("Cdt A. Moreau");
  const box = await page.getByRole("dialog").locator("canvas").boundingBox();
  if (box) {
    await page.mouse.move(box.x + 30, box.y + 100);
    await page.mouse.down();
    const pts = [[60, 60], [90, 110], [120, 50], [150, 115], [190, 70], [230, 95], [270, 60], [320, 100], [360, 80]];
    for (const [x, y] of pts) await page.mouse.move(box.x + x, box.y + y, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(300);
  await snap("signature");

  // Offline: same app, network cut (client-side navigation keeps working)
  await go("/fr/app/carnet/nouveau", 1500);
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.waitForTimeout(600);
  await snap("offline");
  await ctx.setOffline(false);

  // Jobs (needs the employers' feeds: run against a deployment that can reach them) and pilot CV
  await go("/fr/app/emplois", 6000);
  await snap("jobs");
  await go("/fr/app/cv", 2500);
  await snap("cv");

  // Mobile
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme, locale: "fr-FR", isMobile: true, hasTouch: true });
  await mctx.addInitScript((t) => localStorage.setItem("cielo-theme", t), theme);
  const m = await mctx.newPage();
  await m.goto(BASE + "/fr/connexion?demo=1", { waitUntil: "networkidle" });
  await m.getByRole("button", { name: /démonstration/ }).first().click();
  await m.waitForURL("**/fr/app", { timeout: 90_000 });
  await m.waitForTimeout(2000);
  await m.goto(BASE + "/fr/app/carnet", { waitUntil: "networkidle" });
  await m.waitForTimeout(1500);
  await m.screenshot({ path: path.join(dir, "mobile-logbook.png") });
  await m.goto(BASE + "/fr/app", { waitUntil: "networkidle" });
  await m.waitForTimeout(1500);
  await m.screenshot({ path: path.join(dir, "mobile-dashboard.png") });

  await browser.close();
  console.log(`✓ ${theme}`);
}

await shoot("light");
await shoot("dark");
