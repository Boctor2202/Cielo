/**
 * Aircraft photos by exact registration, from the Planespotters.net public photo API.
 * Only the photo metadata passes through Geardown; the image itself is shown from Planespotters' servers
 * (never copied or stored), uncropped, with the photographer's credit and a link back to the photo page.
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
    headers: { Accept: "application/json", "User-Agent": "Geardown pilot logbook (https://geardown.app)" },
    next: { revalidate: 3600 },
  });
  if (!r.ok) throw new Error(`planespotters ${r.status}`);
  const p = ((await r.json()) as Raw).photos?.[0];
  const big = p?.thumbnail_large ?? p?.thumbnail;
  if (!p || !big) return null;
  return { id: p.id, src: big.src, width: big.size.width, height: big.size.height, thumb: p.thumbnail?.src ?? big.src, photographer: p.photographer, link: p.link };
}
