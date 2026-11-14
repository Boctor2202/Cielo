/**
 * Aircraft imagery for the home page, keyed by ICAO type designator.
 * The page shows the aircraft the pilot actually flies (most-flown type in the logbook, or the type picked
 * in the "I fly…" selector). To add a type: drop the files in public/immersive/aircraft/<id>/ and add an entry.
 *
 * Licences: Unsplash photos need no credit; Wikimedia Commons photos (CC BY / CC BY-SA) must be credited
 * with author + licence, and edited versions (cut-outs, crops) stay under the same licence.
 */

export interface Credit {
  subject: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  modified?: boolean;
}

export interface Img {
  /** path without the "-<width>.webp" suffix */
  base: string;
  widths: [number, number];
  /** intrinsic aspect ratio (w / h) */
  ratio: number;
}

export interface AircraftVisual {
  id: string;
  /** ICAO designators served by this set */
  match: string[];
  name: { fr: string; en: string };
  /** Transparent cut-outs flown over the sky (3D layers). */
  cutouts?: { flight: Img; front: Img };
  /** Full-bleed hero photo, used when there is no cut-out. */
  backdrop?: Img;
  /**
   * Scroll-scrubbed film: takeoff (lined up → roll → rotation → lift-off, gear up) then the climb through the clouds.
   * `rotate` and `liftoff` are fractions of the takeoff clip, used by the instruments strip.
   */
  film?: { base: string; poster: string; rotate: number; liftoff: number };
  /** Photos of the type for the "your aircraft" gallery. */
  gallery: (Img & { caption: { fr: string; en: string } })[];
  credits: Credit[];
}

const CC = {
  by4: ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  bysa4: ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
  bysa2: ["CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/"],
  by2: ["CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/"],
  unsplash: ["Unsplash License", "https://unsplash.com/license"],
} as const;
const credit = (subject: string, author: string, l: keyof typeof CC, sourceUrl: string, modified = false): Credit => ({
  subject, author, license: CC[l][0], licenseUrl: CC[l][1], sourceUrl, modified,
});

const A = "/immersive/aircraft";

export const SKY_CREDITS: Credit[] = [
  credit("Sky", "Unsplash", "unsplash", "https://unsplash.com/photos/1499346030926-9a72daac6c63"),
  credit("Dusk", "Unsplash", "unsplash", "https://unsplash.com/photos/1506905925346-21bda4d32df4"),
  credit("Night sky", "Unsplash", "unsplash", "https://unsplash.com/photos/1419242902214-272b3f66ee7a"),
];

export const AIRCRAFT_VISUALS: AircraftVisual[] = [
  {
    id: "c68a",
    match: ["C68A"],
    name: { fr: "Cessna Citation Latitude", en: "Cessna Citation Latitude" },
    film: { base: "/immersive/film/c68a", poster: "/immersive/film/c68a/takeoff-poster", rotate: 0.6, liftoff: 0.7 },
    cutouts: {
      flight: { base: `${A}/c68a/flight`, widths: [800, 1600], ratio: 1554 / 543 },
      front: { base: `${A}/c68a/front`, widths: [800, 1600], ratio: 1889 / 485 },
    },
    gallery: [
      { base: `${A}/c68a/profile`, widths: [800, 1600], ratio: 1920 / 843, caption: { fr: "Profil, au parking", en: "Side view, on the ramp" } },
      { base: `${A}/c68a/detail`, widths: [800, 1600], ratio: 1920 / 1280, caption: { fr: "Nacelle moteur", en: "Engine nacelle" } },
      { base: `${A}/c68a/taxi`, widths: [800, 1600], ratio: 1920 / 1035, caption: { fr: "Au roulage", en: "Taxiing" } },
    ],
    credits: [
      credit("Citation Latitude D-CAWN (in flight)", "kitmasterbloke", "by4", "https://commons.wikimedia.org/wiki/File:D-CAWN_Cessna_680A_Citation_Latitude_STN_230525.jpg", true),
      credit("Citation Latitude N613CL (head-on)", "James from Cheltenham", "bysa2", "https://commons.wikimedia.org/wiki/File:N613CL_Cessna_Citation_Latitude_680A_Textron_Aviation_(30012668735).jpg", true),
      credit("Citation Latitude N980JF", "Acroterion", "bysa4", "https://commons.wikimedia.org/wiki/File:Cessna_Citation_Latitude_N980JF_FDK_MD1.jpg", true),
      credit("Citation Latitude nacelle", "aamanatullah", "by2", "https://commons.wikimedia.org/wiki/File:Citation_Latitude_(28422728969).jpg", true),
      credit("Citation Latitude N626LA", "Tomás Del Coro", "bysa2", "https://commons.wikimedia.org/wiki/File:N626LA_2016_TEXTRON_AVIATION_Cessna_Citation_Latitude_680A_s-n_680A-0026_(30805912733).jpg", true),
    ],
  },
  {
    id: "airliner",
    // also the default set for types without dedicated imagery
    match: [
      "A318", "A319", "A320", "A321", "A19N", "A20N", "A21N", "BCS1", "BCS3", "A332", "A333", "A339", "A343", "A359", "A35K", "A388",
      "B737", "B738", "B739", "B38M", "B39M", "B752", "B763", "B772", "B77W", "B788", "B789", "B78X", "B744", "B748",
      "E170", "E175", "E190", "E195", "E290", "E295", "E145", "CRJ7", "CRJ9", "CRJX",
    ],
    name: { fr: "Avion de ligne", en: "Airliner" },
    backdrop: { base: `${A}/airliner/hero`, widths: [1200, 2400], ratio: 2560 / 1140 },
    gallery: [
      { base: `${A}/airliner/wing`, widths: [1200, 2400], ratio: 1.5, caption: { fr: "En croisière", en: "In cruise" } },
      { base: `${A}/airliner/sunset`, widths: [1200, 2400], ratio: 1.5, caption: { fr: "Coucher de soleil", en: "Sunset" } },
      { base: `${A}/airliner/clouds`, widths: [1200, 2400], ratio: 1.5, caption: { fr: "Mer de nuages", en: "Sea of clouds" } },
    ],
    credits: [
      credit("Airliner taking off", "Unsplash", "unsplash", "https://unsplash.com/photos/1544016768-982d1554f0b9", true),
      credit("Wing above the clouds", "Unsplash", "unsplash", "https://unsplash.com/photos/1436491865332-7a61a109cc05"),
      credit("Sunset", "Unsplash", "unsplash", "https://unsplash.com/photos/1506012787146-f92b2d7d6d96"),
      credit("Sea of clouds", "Unsplash", "unsplash", "https://unsplash.com/photos/1517479149777-5f3b1511d5ad"),
    ],
  },
];

// Visitors and types without dedicated imagery see the business-jet film
export const DEFAULT_VISUAL = AIRCRAFT_VISUALS.find((v) => v.id === "c68a")!;

export const FILM_CREDITS: Credit[] = [
  {
    subject: "Takeoff and climb film (AI-generated, not a real aircraft or airport)",
    author: "Strato",
    license: "Generated with Veo via SYZEL",
    licenseUrl: "https://deepmind.google/models/veo/",
    sourceUrl: "https://deepmind.google/models/veo/",
  },
];

export const EARTH_CREDITS: Credit[] = [
  { subject: "Blue Marble Next Generation (Earth by day)", author: "NASA Earth Observatory", license: "Public domain", licenseUrl: "https://earthobservatory.nasa.gov/image-use-policy", sourceUrl: "https://visibleearth.nasa.gov/collection/1484/blue-marble" },
  { subject: "Black Marble 2016 (Earth at night)", author: "NASA Earth Observatory", license: "Public domain", licenseUrl: "https://earthobservatory.nasa.gov/image-use-policy", sourceUrl: "https://earthobservatory.nasa.gov/features/NightLights" },
  { subject: "Clouds and ocean mask", author: "NASA Visible Earth, via three-globe (MIT)", license: "Public domain", licenseUrl: "https://earthobservatory.nasa.gov/image-use-policy", sourceUrl: "https://github.com/vasturiano/three-globe" },
];

/** Visual set for an ICAO type designator; `exact` tells whether dedicated imagery exists for that type. */
export function visualFor(icao: string | null | undefined): { visual: AircraftVisual; exact: boolean } {
  const k = (icao ?? "").trim().toUpperCase();
  const hit = k ? AIRCRAFT_VISUALS.find((v) => v.match.includes(k)) : undefined;
  return hit ? { visual: hit, exact: true } : { visual: DEFAULT_VISUAL, exact: false };
}

export const srcSet = (img: Img) => img.widths.map((w) => `${img.base}-${w}.webp ${w}w`).join(", ");
export const src = (img: Img, large = true) => `${img.base}-${img.widths[large ? 1 : 0]}.webp`;
