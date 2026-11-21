// Generates the marketing screenshots from the real app with demo data, in each language and theme.
// Usage: node scripts/screenshots.mjs [baseUrl] [locales]   e.g. node scripts/screenshots.mjs https://geardown.app fr,en
// Output: public/screens/<locale>/<light|dark>/<name>.png  (shown by components/marketing/Shot.tsx)
// Run it against a deployment: the jobs page needs the employers' feeds and the map Google Maps.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
}
const { chromium } = pw;

const BASE = process.argv[2] ?? "http://localhost:3000";
const LOCALES = (process.argv[3] ?? "fr,en").split(",");
/** optional: only these screenshots, e.g. "signature,cv" */
const ONLY = process.argv[4]?.split(",");
const want = (...names) => !ONLY || names.some((n) => ONLY.includes(n));
const OUT = path.resolve("public/screens");
/** the demo notice above each page is for visitors trying the demo, not for marketing screenshots */
const hideDemo = (page) => page.evaluate(() => document.querySelectorAll('main p[class*="border-accent/40"]').forEach((e) => e.remove()));

const L = {
  fr: {
    tz: "fr-FR",
    login: "/fr/connexion?demo=1",
    demo: /démonstration/,
    app: "/fr/app",
    logbook: "/fr/app/carnet",
    import: "/fr/app/carnet/import",
    audit: "/fr/app/carnet/audit",
    documents: "/fr/app/documents",
    ftl: "/fr/app/ftl",
    stats: "/fr/app/statistiques",
    roster: "/fr/app/roster",
    newFlight: "/fr/app/carnet/nouveau",
    jobs: "/fr/app/emplois",
    cv: "/fr/app/cv",
    importBtn: /Vérifier les totaux \(\d/,
    confirmBtn: /Valider et importer \(\d/,
    onTypeOnly: /Sur mes types uniquement/,
    sign: /Faire signer/,
    signer: "Cdt A. Moreau",
    csv: [
      "Date;Départ;Arrivée;Off block;On block;Immatriculation;Type;Fonction;Nuit;Remarques",
      "02/10/2026;LFPN;LFOP;09:10;10:25;F-GSTR;DR40;PIC;;Navigation",
      "02/10/2026;LFOP;LFPN;11:00;12:20;F-GSTR;DR40;PIC;;",
      "02/10/2026;LFOP;LFPN;11:00;12:20;F-GSTR;DR40;PIC;;Doublon",
      "03/10/2026;LFPN;LFRK;14:00;13:30;F-GSTR;DR40;PIC;2:00;Heures inversées",
    ],
  },
  en: {
    tz: "en-GB",
    login: "/en/login?demo=1",
    demo: /demo data/i,
    app: "/en/app",
    logbook: "/en/app/logbook",
    import: "/en/app/logbook/import",
    audit: "/en/app/logbook/audit",
    documents: "/en/app/documents",
    ftl: "/en/app/ftl",
    stats: "/en/app/statistics",
    roster: "/en/app/roster",
    newFlight: "/en/app/logbook/new",
    jobs: "/en/app/jobs",
    cv: "/en/app/cv",
    importBtn: /Check the totals \(\d/,
    confirmBtn: /Confirm and import \(\d/,
    onTypeOnly: /My types only/,
    sign: /Get it signed/,
    signer: "Capt. A. Moore",
    csv: [
      "Date;From;To;Off block;On block;Registration;Type;Function;Night;Remarks",
      "02/10/2026;EGLF;EGTF;09:10;10:25;G-OSTR;DR40;PIC;;Cross-country",
      "02/10/2026;EGTF;EGLF;11:00;12:20;G-OSTR;DR40;PIC;;",
      "02/10/2026;EGTF;EGLF;11:00;12:20;G-OSTR;DR40;PIC;;Duplicate",
      "03/10/2026;EGLF;EGKB;14:00;13:30;G-OSTR;DR40;PIC;2:00;Swapped times",
    ],
  },
};

/** Demo pilot as a subscriber: no demo banner on the screenshots. */
const subscribe = (page) =>
  page.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("cielo");
      q.onsuccess = () => r(q.result);
    });
    const ps = await new Promise((r) => {
      const q = db.transaction("pilots").objectStore("pilots").getAll();
      q.onsuccess = () => r(q.result);
    });
    await new Promise((r) => {
      const t = db.transaction("pilots", "readwrite");
      for (const p of ps) t.objectStore("pilots").put({ ...p, subscriptionTier: "premium", subscriptionExpiresAt: null });
      t.oncomplete = r;
    });
  });

async function login(page, l) {
  await page.goto(BASE + l.login, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: l.demo }).first().click();
  await page.waitForURL(`**${l.app}`, { timeout: 90_000 });
  await page.waitForTimeout(2500);
  await subscribe(page);
}

async function shoot(locale, theme) {
  const l = L[locale];
  const dir = path.join(OUT, locale, theme);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, colorScheme: theme, locale: l.tz, timezoneId: "Europe/Paris" });
  await ctx.addInitScript((t) => localStorage.setItem("cielo-theme", t), theme);
  const page = await ctx.newPage();
  const go = async (p, wait = 1800) => {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(wait);
  };
  const snap = async (name) => {
    if (!want(name)) return;
    await hideDemo(page);
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
  };

  await login(page, l);
  if (want("dashboard", "logbook")) {
    await go(l.app, 2500);
    await snap("dashboard");
    await go(l.logbook);
    await snap("logbook");
  }

  if (want("import", "audit")) {
  // Import: automatic column detection + preview, then import (feeds the audit screenshot)
  await go(l.import);
  const tmp = path.join(OUT, `_sample-${locale}.csv`);
  fs.writeFileSync(tmp, l.csv.join("\n"));
  await page.setInputFiles('input[type="file"]', tmp);
  await page.waitForTimeout(1200);
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(400);
  await snap("import");
  // the import goes through the "Check your totals" step before anything is saved
  await page.getByRole("button", { name: l.importBtn }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: l.confirmBtn }).click();
  await page.waitForTimeout(1500);
  fs.rmSync(tmp);
  await go(l.audit);
  await snap("audit");
  }
  if (want("licenses", "ftl", "stats", "roster")) {
    await go(l.documents);
    await snap("licenses");
    await go(l.ftl);
    await snap("ftl");
    await go(l.stats, 2500);
    await snap("stats");
    await go(l.roster);
    await snap("roster");
  }

  // Signature: open the latest flight and draw
  if (want("signature")) {
  await go(l.logbook);
  // first flight of the list (rows link to /app/carnet/<id>, /en/app/logbook/<id>)
  await page.locator("a[href]").filter({ has: page.locator("text=/\\d:\\d\\d/") }).evaluateAll((as) => {
    const a = as.find((x) => /\/(carnet|logbook)\/[^/]{12,}$/.test(x.getAttribute("href") ?? ""));
    a?.click();
  });
  await page.waitForTimeout(2000);
  // the button sits low in the form and the dialog locks scrolling when it opens: open it from the top of
  // the page, with a DOM click that does not scroll the button into view
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: l.sign }).evaluate((b) => b.click());
  await page.waitForTimeout(800);
  await page.getByRole("dialog").locator("input").first().fill(l.signer);
  const box = await page.getByRole("dialog").locator("canvas").boundingBox();
  if (box) {
    await page.mouse.move(box.x + 30, box.y + 100);
    await page.mouse.down();
    for (const [x, y] of [[60, 60], [90, 110], [120, 50], [150, 115], [190, 70], [230, 95], [270, 60], [320, 100], [360, 80]]) await page.mouse.move(box.x + x, box.y + y, { steps: 6 });
    await page.mouse.up();
  }
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.waitForTimeout(400);
  await snap("signature");
  }

  // Offline: same app, network cut (client-side navigation keeps working)
  if (want("offline", "jobs", "cv")) {
  await go(l.newFlight, 1800);
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.waitForTimeout(800);
  await snap("offline");
  await ctx.setOffline(false);

  await go(l.jobs, 6000);
  // offers on the demo pilot's type only, and employers' names and places blurred: the screenshot shows the
  // feature, not who is hiring
  await page.getByText(l.onTypeOnly).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelectorAll("p.text-accent.font-semibold, svg.lucide-map-pin").forEach((e) => {
      const el = e.tagName === "svg" ? e.parentElement : e;
      if (el) el.style.filter = "blur(5px)";
    });
  });
  await snap("jobs");
  await go(l.cv, 2500);
  await snap("cv");
  }

  // Mobile
  if (want("mobile-logbook", "mobile-dashboard")) {
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme, locale: l.tz, isMobile: true, hasTouch: true });
  await mctx.addInitScript((t) => localStorage.setItem("cielo-theme", t), theme);
  const m = await mctx.newPage();
  await login(m, l);
  await m.goto(BASE + l.logbook, { waitUntil: "networkidle" });
  await m.waitForTimeout(1800);
  await hideDemo(m);
  await m.screenshot({ path: path.join(dir, "mobile-logbook.png") });
  await m.goto(BASE + l.app, { waitUntil: "networkidle" });
  await m.waitForTimeout(2500);
  await hideDemo(m);
  await m.screenshot({ path: path.join(dir, "mobile-dashboard.png") });
  }

  await browser.close();
  console.log(`✓ ${locale} ${theme}`);
}

for (const locale of LOCALES) {
  await shoot(locale, "light");
  await shoot(locale, "dark");
}
