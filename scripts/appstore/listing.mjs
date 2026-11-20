// Geardown's App Store page through Apple's API: the description (French and English) with the links to the terms
// and the privacy policy that subscriptions require, the privacy policy URL, and the support URL.
// Safe to run again. Same App Store Connect key as subscriptions.mjs (ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY).
// Run: node scripts/appstore/listing.mjs            (or --check to only show what is there)
import { createHash, createPrivateKey, sign } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE_ID = "app.geardown.logbook";
const CHECK = process.argv.includes("--check");
const SHOTS = process.argv.includes("--screenshots");
const SHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "shots/final");
const SHOT_LOCALE = { "fr-FR": "fr", "en-US": "en" };

const TEXT = {
  "fr-FR": {
    subtitle: "Carnet de vol, FTL, CV, emploi",
    keywords: "logbook,pilote,heures de vol,licence,médical,roster,escales,radar,badges,EASA,FAA,import,aviation",
    privacyPolicyUrl: "https://geardown.app/fr/legal/confidentialite",
    supportUrl: "https://geardown.app/fr/contact",
    marketingUrl: "https://geardown.app/fr",
    description: `Geardown est le carnet de vol électronique des pilotes professionnels. Saisissez un vol en quelques secondes, importez votre planning, suivez vos licences et votre expérience récente : votre carnet est à jour, conforme et toujours avec vous, sur iPhone comme sur le web.

CARNET DE VOL
• Saisie rapide : numéro de vol, avion, horaires bloc et vol, fonction, IFR, nuit, atterrissages
• Reconnaissance automatique de l'opérateur et des aéroports
• Import de votre ancien carnet (CSV, photo de pages) et de votre roster
• Exports officiels au format EASA / FAA, signés et prêts pour un contrôle

LICENCES ET EXPÉRIENCE RÉCENTE
• Licence, certificat médical, qualifications et contrôles avec leurs dates de validité
• Rappels avant expiration
• Suivi des 3 décollages et atterrissages sur 90 jours et des limites FTL

STATISTIQUES ET DISTINCTIONS
• Heures par avion, par fonction, par opérateur, de jour et de nuit
• Aéroports et pays visités, distances parcourues, badges à débloquer

GEARDOWN MAX
• Roster et suivi FTL, escales, radar en direct et traces réelles de vos vols
• Audit du carnet, signatures, offres d'emploi et CV pilote généré à partir de vos vols

ABONNEMENTS
Geardown propose deux formules, Basic et Max, au mois ou à l'année, avec 7 jours d'essai gratuit. Le paiement est débité de votre compte Apple à la fin de l'essai. L'abonnement se renouvelle automatiquement sauf résiliation au moins 24 heures avant la fin de la période en cours ; vous pouvez le gérer ou le résilier à tout moment dans les réglages de votre compte App Store.

Conditions d'utilisation : https://geardown.app/fr/legal/cgu
Politique de confidentialité : https://geardown.app/fr/legal/confidentialite`,
  },
  "en-US": {
    subtitle: "Logbook, FTL, CV & pilot jobs",
    keywords: "pilot,flight hours,licence,medical,roster,layovers,radar,EASA,FAA,airline,currency,import,badges",
    privacyPolicyUrl: "https://geardown.app/en/legal/privacy",
    supportUrl: "https://geardown.app/en/contact",
    marketingUrl: "https://geardown.app/en",
    description: `Geardown is the electronic logbook for professional pilots. Log a flight in seconds, import your roster, track your licences and recency: your logbook is up to date, compliant and always with you, on iPhone and on the web.

LOGBOOK
• Fast entry: flight number, aircraft, block and flight times, function, IFR, night, landings
• Operator and airports recognised automatically
• Import your previous logbook (CSV, photos of pages) and your roster
• Official EASA / FAA exports, signed and ready for an inspection

LICENCES AND RECENCY
• Licence, medical, ratings and checks with their expiry dates
• Reminders before they expire
• 3 take-offs and landings in 90 days and FTL limits tracked for you

STATISTICS AND DISTINCTIONS
• Hours by aircraft, function and operator, by day and by night
• Airports and countries visited, distance flown, badges to unlock

GEARDOWN MAX
• Roster and FTL monitoring, layovers, live radar and the real tracks of your flights
• Logbook audit, signatures, job offers and a pilot CV built from your flights

SUBSCRIPTIONS
Geardown offers two plans, Basic and Max, monthly or yearly, with a 7-day free trial. Payment is charged to your Apple account at the end of the trial. The subscription renews automatically unless cancelled at least 24 hours before the end of the current period; manage or cancel it at any time in your App Store account settings.

Terms of use: https://geardown.app/en/legal/terms
Privacy policy: https://geardown.app/en/legal/privacy`,
  },
};

// ---------- API ----------
const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k}`);
  return v;
};
const KEY_ID = env("ASC_KEY_ID");
const ISSUER = env("ASC_ISSUER_ID");
const PRIVATE_KEY = createPrivateKey(env("ASC_PRIVATE_KEY").replace(/\\n/g, "\n"));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
  const body = b64({ iss: ISSUER, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" });
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key: PRIVATE_KEY, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}
async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${(json.errors ?? []).map((e) => `${e.code} ${e.detail ?? e.title}`).join("; ") || text}`);
  return json;
}
const log = (...a) => console.log(...a);
const EDITABLE = new Set(["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY", "WAITING_FOR_REVIEW"]);

async function main() {
  const [app] = (await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data;
  log(`App: ${app.attributes.name} (${app.id}), primary locale ${app.attributes.primaryLocale}`);

  // privacy policy URL: on the app info being edited
  const infos = (await api("GET", `/v1/apps/${app.id}/appInfos`)).data;
  const info = infos.find((i) => !["READY_FOR_DISTRIBUTION", "READY_FOR_SALE"].includes(i.attributes.appStoreState ?? i.attributes.state)) ?? infos[0];
  log(`App info ${info.id}: ${info.attributes.appStoreState ?? info.attributes.state}`);
  const infoLocs = (await api("GET", `/v1/appInfos/${info.id}/appInfoLocalizations`)).data;
  for (const [locale, t] of Object.entries(TEXT)) {
    const l = infoLocs.find((x) => x.attributes.locale === locale);
    log(`  ${locale}: name "${l?.attributes.name ?? "-"}", privacy policy ${l?.attributes.privacyPolicyUrl ?? "none"}`);
    if (CHECK) continue;
    if (l) await api("PATCH", `/v1/appInfoLocalizations/${l.id}`, { data: { type: "appInfoLocalizations", id: l.id, attributes: { privacyPolicyUrl: t.privacyPolicyUrl, subtitle: t.subtitle } } });
    else await api("POST", "/v1/appInfoLocalizations", { data: { type: "appInfoLocalizations", attributes: { locale, name: app.attributes.name, privacyPolicyUrl: t.privacyPolicyUrl, subtitle: t.subtitle }, relationships: { appInfo: { data: { type: "appInfos", id: info.id } } } } });
    log(`  ${locale}: privacy policy and subtitle "${t.subtitle}" set`);
  }

  // description: on the iOS version being prepared
  const versions = (await api("GET", `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data;
  for (const v of versions) log(`Version ${v.attributes.versionString}: ${v.attributes.appStoreState ?? v.attributes.appVersionState}`);
  const version = versions.find((v) => EDITABLE.has(v.attributes.appStoreState ?? v.attributes.appVersionState));
  if (!version) {
    log("No version open for editing: the description is set on the next version (create it in App Store Connect, then run again).");
    return;
  }
  const locs = (await api("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data;
  for (const [locale, t] of Object.entries(TEXT)) {
    const l = locs.find((x) => x.attributes.locale === locale);
    log(`\n${locale} current description (${l?.attributes.description?.length ?? 0} chars):\n${l?.attributes.description ?? "(none)"}\n`);
    if (CHECK) continue;
    const attributes = { description: t.description, keywords: t.keywords, supportUrl: l?.attributes.supportUrl || t.supportUrl, marketingUrl: l?.attributes.marketingUrl || t.marketingUrl };
    if (l) await api("PATCH", `/v1/appStoreVersionLocalizations/${l.id}`, { data: { type: "appStoreVersionLocalizations", id: l.id, attributes } });
    else await api("POST", "/v1/appStoreVersionLocalizations", { data: { type: "appStoreVersionLocalizations", attributes: { locale, ...attributes }, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } } } });
    log(`${locale}: description, keywords, support and marketing URLs set`);
  }
  if (SHOTS) await screenshots(version.id);
}

/** The App Store screenshots (iPhone 6.9"/6.7", 1290 × 2796) from shots/final/<fr|en>/1..n.jpg, replacing what is there. */
async function screenshots(versionId) {
  const locs = (await api("GET", `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`)).data;
  for (const [locale, dir] of Object.entries(SHOT_LOCALE)) {
    const loc = locs.find((l) => l.attributes.locale === locale);
    if (!loc) { log(`${locale}: no localization`); continue; }
    const sets = (await api("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`)).data;
    let set = sets.find((x) => x.attributes.screenshotDisplayType === "APP_IPHONE_67");
    if (set) {
      for (const old of (await api("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data) await api("DELETE", `/v1/appScreenshots/${old.id}`);
    } else {
      set = (await api("POST", "/v1/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: "APP_IPHONE_67" }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } } } })).data;
    }
    const files = readdirSync(join(SHOT_DIR, dir)).filter((f) => /\.(jpg|png)$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
    for (const f of files) {
      const buf = readFileSync(join(SHOT_DIR, dir, f));
      const shot = (await api("POST", "/v1/appScreenshots", { data: { type: "appScreenshots", attributes: { fileName: `${dir}-${f}`, fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } } } })).data;
      for (const op of shot.attributes.uploadOperations) {
        const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
        const up = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
        if (!up.ok) throw new Error(`upload ${f}: ${up.status}`);
      }
      await api("PATCH", `/v1/appScreenshots/${shot.id}`, { data: { type: "appScreenshots", id: shot.id, attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(buf).digest("hex") } } });
    }
    log(`${locale}: ${files.length} screenshots uploaded`);
    await new Promise((r) => setTimeout(r, 15000));
    for (const x of (await api("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data) log(`  ${x.attributes.fileName}: ${x.attributes.assetDeliveryState?.state} ${JSON.stringify(x.attributes.assetDeliveryState?.errors ?? [])}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
