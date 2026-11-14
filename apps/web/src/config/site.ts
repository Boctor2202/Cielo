/**
 * Marketing variables — fill in before launch. Prices in euros, VAT included.
 * Leave a stat at null to hide it from the proof band.
 */
export const SITE = {
  name: "Geardown",
  domain: "geardown.app",
  contactEmail: "contact@geardown.app",
  stats: {
    hoursLogged: null as number | null, // e.g. 2_500_000
    pilots: null as number | null, // e.g. 12_000
    airlinesSupported: null as number | null, // e.g. 140
  },
  pricing: {
    currency: "EUR",
    /** monthly only, after a 7-day trial (card required); "premium" is the Max plan */
    basic: { monthly: 6.99 },
    premium: { monthly: 9.99 },
    trialDays: 7,
  },
  stores: {
    appStoreUrl: "#", // https://apps.apple.com/app/id...
    playStoreUrl: "#", // https://play.google.com/store/apps/details?id=app.geardown.logbook
  },
  social: {
    instagram: "#",
    linkedin: "#",
    youtube: "#",
    x: "#",
  },
  company: {
    legalName: "[Raison sociale]",
    address: "[Adresse du siège]",
    registration: "[RCS / SIREN]",
    publisher: "[Directeur de la publication]",
    host: "[Hébergeur — nom, adresse]",
  },
};

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://demotiles.maplibre.org/style.json";
export const isCloudEnabled = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
