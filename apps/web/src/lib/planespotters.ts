/**
 * Aircraft photos by exact registration, from the Planespotters.net public photo API
 * (terms: https://www.planespotters.net/photo/api#terms).
 * - Only the JSON passes through Geardown, cached for less than 24 h in total (1 h here + 18 h stale at the CDN).
 * - The browser loads the image straight from the returned URL, unchanged; it is never stored, proxied or re-hosted
 *   (no next/image, no service worker), and never used for any AI/ML purpose.
 * - The photographer is credited next to the image and the image links to `link` (plain anchor, no nofollow).
 * - Server requests identify Geardown with a contact in the User-Agent.
 */
export interface AircraftPhoto {
  id: string;
  /** 420×280 */
  src: string;
  width: number;
  height: number;
  /** 200×133 */
  thumb: string;
  photographer: string;
  /** photo page on planespotters.net */
  link: string;
}

interface Raw {
  photos?: {
    id: string;
    thumbnail?: { src: string; size: { width: number; height: number } };
    thumbnail_large?: { src: string; size: { width: number; height: number } };
    link: string;
    photographer: string;
  }[];
}

export const planespottersEnabled = () => process.env.NEXT_PUBLIC_PLANESPOTTERS === "1";

export async function photoForRegistration(registration: string): Promise<AircraftPhoto | null> {
  const reg = registration.trim().toUpperCase();
  const r = await fetch(`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`, {
    headers: { Accept: "application/json", "User-Agent": "Geardown/1.0 (+mailto:contact@geardown.app; https://geardown.app)" },
    next: { revalidate: 3600 },
  });
  if (!r.ok) throw new Error(`planespotters ${r.status}`);
  const p = ((await r.json()) as Raw).photos?.[0];
  const big = p?.thumbnail_large ?? p?.thumbnail;
  if (!p || !big) return null;
  return { id: p.id, src: big.src, width: big.size.width, height: big.size.height, thumb: p.thumbnail?.src ?? big.src, photographer: p.photographer, link: p.link };
}
