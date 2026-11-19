// Creates Geardown's subscriptions in App Store Connect through Apple's API, so nobody has to fill the forms:
// the group, the four plans (Basic / Max, monthly / yearly), their French and English texts, their prices in every
// country (from the French price, as App Store Connect does), the 7-day free trial, the review screenshot and notes.
// Safe to run again: whatever already exists is kept and only what is missing is added.
//
// Needs an App Store Connect API key (Users and Access › Integrations › App Store Connect API, role "App Manager"):
//   ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (the content of the .p8 file)
// Run: node scripts/appstore/subscriptions.mjs            (or --check to only show what exists)
import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE_ID = "app.geardown.logbook";
const GROUP = "Geardown";
const BASE_TERRITORY = "FRA";
const CHECK = process.argv.includes("--check");

const REVIEW_NOTE =
  "Geardown is a pilot e-logbook. Basic unlocks the unlimited logbook, official exports, licence and recency tracking, statistics and web/mobile sync. Max adds roster import and FTL monitoring, layovers, live radar, audit, signatures, job offers and the pilot CV. Both plans start with a 7-day free trial. The subscription screen is in the app under More › Subscription.";

const PLANS = [
  {
    productId: "geardown_max_yearly", ref: "Max annuel", period: "ONE_YEAR", level: 1, price: "89.99",
    fr: ["Geardown Max – Annuel", "Tout Geardown, avec 2 mois offerts."],
    en: ["Geardown Max – Yearly", "All of Geardown, with 2 months free."],
  },
  {
    productId: "geardown_max_monthly", ref: "Max mensuel", period: "ONE_MONTH", level: 2, price: "8.99",
    fr: ["Geardown Max – Mensuel", "Tout Basic + roster, FTL, radar, CV et signatures."],
    en: ["Geardown Max – Monthly", "All of Basic + roster, FTL, radar, CV, signatures."],
  },
  {
    productId: "geardown_basic_yearly", ref: "Basic annuel", period: "ONE_YEAR", level: 3, price: "49.99",
    fr: ["Geardown Basic – Annuel", "Carnet illimité et exports. 2 mois offerts."],
    en: ["Geardown Basic – Yearly", "Unlimited logbook and exports. 2 months free."],
  },
  {
    productId: "geardown_basic_monthly", ref: "Basic mensuel", period: "ONE_MONTH", level: 4, price: "4.99",
    fr: ["Geardown Basic – Mensuel", "Carnet illimité, exports officiels et synchro."],
    en: ["Geardown Basic – Monthly", "Unlimited logbook, official exports and sync."],
  },
];

// ---------- API ----------
const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k}`);
  return v;
};
const KEY_ID = env("ASC_KEY_ID");
const ISSUER = env("ASC_ISSUER_ID");
const PRIVATE_KEY = createPrivateKey(env("ASC_PRIVATE_KEY").replace(/\\n/g, "\n"));
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
let token = { value: "", until: 0 };
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  if (token.until > now + 60) return token.value;
  const head = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
  const body = b64({ iss: ISSUER, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" });
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key: PRIVATE_KEY, dsaEncoding: "ieee-p1363" }).toString("base64url");
  token = { value: `${head}.${body}.${sig}`, until: now + 1100 };
  return token.value;
}

async function api(method, path, body) {
  const url = path.startsWith("http") ? path : `https://api.appstoreconnect.apple.com${path}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = new Error(`${method} ${path} → ${res.status}: ${(json.errors ?? []).map((e) => `${e.code} ${e.detail ?? e.title}`).join("; ") || text}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }
}
async function all(path) {
  const out = [];
  let next = path;
  while (next) {
    const r = await api("GET", next);
    out.push(...(r.data ?? []));
    next = r.links?.next ?? null;
  }
  return out;
}
const rel = (type, id) => ({ data: { type, id } });
const log = (...a) => console.log(...a);

// ---------- steps ----------
async function main() {
  const [app] = (await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data;
  if (!app) throw new Error(`App ${BUNDLE_ID} not found for this key`);
  log(`App: ${app.attributes.name} (${app.id})`);

  let group = (await all(`/v1/apps/${app.id}/subscriptionGroups?limit=200`)).find((g) => g.attributes.referenceName === GROUP);
  const existing = group ? await all(`/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`) : [];
  if (CHECK) {
    log(group ? `Group "${GROUP}" exists` : `Group "${GROUP}" missing`);
    for (const p of PLANS) {
      const s = existing.find((x) => x.attributes.productId === p.productId);
      log(`  ${p.productId}: ${s ? s.attributes.state : "missing"}`);
    }
    return;
  }

  if (!group) {
    group = (await api("POST", "/v1/subscriptionGroups", { data: { type: "subscriptionGroups", attributes: { referenceName: GROUP }, relationships: { app: rel("apps", app.id) } } })).data;
    log(`Group created (${group.id})`);
  }
  const groupLocs = await all(`/v1/subscriptionGroups/${group.id}/subscriptionGroupLocalizations?limit=50`);
  for (const locale of ["fr-FR", "en-US"]) {
    if (groupLocs.some((l) => l.attributes.locale === locale)) continue;
    await api("POST", "/v1/subscriptionGroupLocalizations", {
      data: { type: "subscriptionGroupLocalizations", attributes: { locale, name: GROUP }, relationships: { subscriptionGroup: rel("subscriptionGroups", group.id) } },
    });
    log(`Group name ${locale}`);
  }

  const territories = (await all("/v1/territories?limit=200")).map((t) => t.id);
  log(`${territories.length} countries`);
  const shot = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "review-subscription.jpg"));

  for (const p of PLANS) {
    log(`\n— ${p.productId}`);
    let sub = existing.find((x) => x.attributes.productId === p.productId);
    if (!sub) {
      sub = (await api("POST", "/v1/subscriptions", {
        data: {
          type: "subscriptions",
          attributes: { name: p.ref, productId: p.productId, subscriptionPeriod: p.period, familySharable: false, groupLevel: p.level, reviewNote: REVIEW_NOTE },
          relationships: { group: rel("subscriptionGroups", group.id) },
        },
      })).data;
      log("  created");
    } else {
      await api("PATCH", `/v1/subscriptions/${sub.id}`, { data: { type: "subscriptions", id: sub.id, attributes: { reviewNote: REVIEW_NOTE, familySharable: false } } }).catch((e) => log(`  (note kept: ${e.message})`));
    }

    // texts
    const locs = await all(`/v1/subscriptions/${sub.id}/subscriptionLocalizations?limit=50`);
    for (const [locale, [name, description]] of [["fr-FR", p.fr], ["en-US", p.en]]) {
      const l = locs.find((x) => x.attributes.locale === locale);
      if (l) await api("PATCH", `/v1/subscriptionLocalizations/${l.id}`, { data: { type: "subscriptionLocalizations", id: l.id, attributes: { name, description } } });
      else await api("POST", "/v1/subscriptionLocalizations", { data: { type: "subscriptionLocalizations", attributes: { locale, name, description }, relationships: { subscription: rel("subscriptions", sub.id) } } });
    }
    log("  texts FR / EN");

    // countries
    try {
      await api("POST", "/v1/subscriptionAvailabilities", {
        data: {
          type: "subscriptionAvailabilities",
          attributes: { availableInNewTerritories: true },
          relationships: { subscription: rel("subscriptions", sub.id), availableTerritories: { data: territories.map((id) => ({ type: "territories", id })) } },
        },
      });
      log("  available in every country");
    } catch (e) {
      log(`  availability: ${e.message}`);
    }

    // prices: the French price point, then its equivalent in every other country
    const havePrices = await all(`/v1/subscriptions/${sub.id}/prices?include=territory&limit=200`).catch(() => []);
    const priced = new Set(havePrices.map((x) => x.relationships?.territory?.data?.id).filter(Boolean));
    const points = await all(`/v1/subscriptions/${sub.id}/pricePoints?filter[territory]=${BASE_TERRITORY}&limit=200`);
    const base = points.find((x) => Number(x.attributes.customerPrice) === Number(p.price));
    if (!base) throw new Error(`No ${p.price} € price point in France`);
    const eq = await all(`/v1/subscriptionPricePoints/${base.id}/equalizations?include=territory&limit=200`);
    const targets = [{ territory: BASE_TERRITORY, point: base.id }, ...eq.map((x) => ({ territory: x.relationships?.territory?.data?.id, point: x.id }))].filter((x) => x.territory && !priced.has(x.territory));
    let n = 0;
    for (const t of targets) {
      try {
        await api("POST", "/v1/subscriptionPrices", {
          data: {
            type: "subscriptionPrices",
            attributes: { preserveCurrentPrice: false },
            relationships: { subscription: rel("subscriptions", sub.id), subscriptionPricePoint: rel("subscriptionPricePoints", t.point), territory: rel("territories", t.territory) },
          },
        });
        n++;
      } catch (e) {
        log(`  price ${t.territory}: ${e.message}`);
      }
    }
    log(`  prices: ${p.price} € in France, ${n} countries added (${priced.size} already set)`);

    // 7-day free trial, every country
    const offers = await all(`/v1/subscriptions/${sub.id}/introductoryOffers?include=territory&limit=200`).catch(() => []);
    const offered = new Set(offers.map((x) => x.relationships?.territory?.data?.id).filter(Boolean));
    let o = 0;
    for (const territory of territories) {
      if (offered.has(territory)) continue;
      try {
        await api("POST", "/v1/subscriptionIntroductoryOffers", {
          data: {
            type: "subscriptionIntroductoryOffers",
            attributes: { duration: "ONE_WEEK", offerMode: "FREE_TRIAL", numberOfPeriods: 1 },
            relationships: { subscription: rel("subscriptions", sub.id), territory: rel("territories", territory) },
          },
        });
        o++;
      } catch (e) {
        if (e.status !== 409) log(`  trial ${territory}: ${e.message}`);
      }
    }
    log(`  free trial 1 week: ${o} countries added (${offered.size} already set)`);

    // review screenshot
    const current = await api("GET", `/v1/subscriptions/${sub.id}/appStoreReviewScreenshot`).catch(() => ({ data: null }));
    if (!current.data) {
      const res = (await api("POST", "/v1/subscriptionAppStoreReviewScreenshots", {
        data: { type: "subscriptionAppStoreReviewScreenshots", attributes: { fileName: "subscription.jpg", fileSize: shot.length }, relationships: { subscription: rel("subscriptions", sub.id) } },
      })).data;
      for (const op of res.attributes.uploadOperations) {
        const part = shot.subarray(op.offset, op.offset + op.length);
        const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
        const up = await fetch(op.url, { method: op.method, headers, body: part });
        if (!up.ok) throw new Error(`screenshot upload ${up.status}`);
      }
      await api("PATCH", `/v1/subscriptionAppStoreReviewScreenshots/${res.id}`, {
        data: { type: "subscriptionAppStoreReviewScreenshots", id: res.id, attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(shot).digest("hex") } },
      });
      log("  review screenshot");
    }
  }

  log("\nState:");
  for (const s of await all(`/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`)) log(`  ${s.attributes.productId}: ${s.attributes.state}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
