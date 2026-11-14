/**
 * Marketing variables — fill in before launch. Prices in euros, VAT included.
 * Leave a stat at null to hide it from the proof band.
 */
export const SITE = {
  name: "Sillage",
  domain: "sillage.app",
  contactEmail: "contact@sillage.app",
  stats: {
    hoursLogged: null as number | null, // e.g. 2_500_000
    pilots: null as number | null, // e.g. 12_000
    airlinesSupported: null as number | null, // e.g. 140
  },
  pricing: {
    currency: "EUR",
    basic: { monthly: 4.99, yearly: 39.99 },
    premium: { monthly: 8.99, yearly: 69.99 },
    /** shown as "-x %" on the yearly toggle */
    yearlyDiscountLabel: "-33 %",
  },
  stores: {
    appStoreUrl: "#", // https://apps.apple.com/app/id...
    playStoreUrl: "#", // https://play.google.com/store/apps/details?id=app.sillage.logbook
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
