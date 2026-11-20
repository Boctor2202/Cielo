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
    /** prices for new subscribers, VAT included; existing subscribers keep theirs. "premium" is the Max plan.
     * Mirrors PRICES_EUR / YEARLY_PRICES_EUR in core. */
    basic: { monthly: 3.99 as number | undefined, yearly: 39.99 },
    premium: { monthly: 8.99 as number | undefined, yearly: 89.99 },
    trialDays: 30,
  },
  /** the brand line, in English in every language */
  slogan: "From gear up to gear down.",
  /** public TestFlight link of the iPhone beta (null until created): replaces the store badges with « Join the beta » */
  betaUrl: null as string | null,
  stores: {
    appStoreUrl: "#", // https://apps.apple.com/app/id...
    playStoreUrl: "#", // https://play.google.com/store/apps/details?id=app.geardown.logbook
  },
  social: {
    instagram: "https://www.instagram.com/geardown_app/",
    linkedin: "#",
    youtube: "#",
    x: "#",
  },
  /** where the account's data is hosted, said on the site only once confirmed (e.g. "eu"); null = not stated */
  dataRegion: null as "eu" | null,
  company: {
    legalName: "[Raison sociale]",
    address: "[Adresse du siège]",
    registration: "[RCS / SIREN]",
    publisher: "[Directeur de la publication]",
    /** site and server functions; the logbook database is a separate processor (see dataHost) */
    host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA (vercel.com)",
    dataHost: "Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 (supabase.com), sur des serveurs situés à Londres (Royaume-Uni)",
    dataHostEn: "Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992 (supabase.com), on servers located in London (United Kingdom)",
    /** consumer mediator (Code de la consommation, art. L612-1): name, address and website once joined */
    mediator: "[Médiateur de la consommation — nom, adresse, site]",
  },
};

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://demotiles.maplibre.org/style.json";
export const isCloudEnabled = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
