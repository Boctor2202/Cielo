/**
 * Shows and concerts during a layover, from the Ticketmaster Discovery API (v2), called live from the server
 * with TICKETMASTER_API_KEY. Events link to Ticketmaster for tickets; nothing is stored.
 */
import { distanceM } from "./places";

export type EventKind = "all" | "concerts" | "shows";

export interface LiveEvent {
  id: string;
  name: string;
  /** local date and time at the venue */
  date: string;
  time?: string;
  venue?: string;
  city?: string;
  distanceM?: number;
  genre?: string;
  segment?: string;
  priceFrom?: number;
  currency?: string;
  image?: string;
  url?: string;
  status?: string;
}

export class EventsError extends Error {
  constructor(public code: "not_configured" | "upstream", message: string, public status = 502) {
    super(message);
  }
}

const SEGMENTS: Record<EventKind, string | undefined> = {
  all: "Music,Arts & Theatre",
  concerts: "Music",
  shows: "Arts & Theatre",
};

interface TmEvent {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string }; status?: { code?: string } };
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  priceRanges?: { min?: number; currency?: string }[];
  images?: { url: string; ratio?: string; width?: number }[];
  _embedded?: { venues?: { name?: string; city?: { name?: string }; location?: { latitude?: string; longitude?: string } }[] };
}

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Events within `radiusKm` of a point between two dates (ISO), soonest first. */
export async function eventsNear(
  center: { lat: number; lng: number },
  from: Date,
  to: Date,
  kind: EventKind,
  lang: string,
  radiusKm = 20,
): Promise<LiveEvent[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) throw new EventsError("not_configured", "TICKETMASTER_API_KEY is not set", 503);
  const qs = new URLSearchParams({
    apikey: key,
    latlong: `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`,
    radius: String(radiusKm),
    unit: "km",
    startDateTime: iso(from),
    endDateTime: iso(to),
    sort: "date,asc",
    size: "60",
    locale: lang === "en" ? "en-us" : "fr-fr,en-us,*",
  });
  const seg = SEGMENTS[kind];
  if (seg) qs.set("classificationName", seg);
  const r = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${qs}`, { cache: "no-store" });
  if (!r.ok) throw new EventsError("upstream", `Ticketmaster ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()) as { _embedded?: { events?: TmEvent[] } };
  const seen = new Set<string>();
  return (d._embedded?.events ?? [])
    .filter((e) => e.dates?.start?.localDate && e.dates.status?.code !== "cancelled")
    .map((e) => {
      const v = e._embedded?.venues?.[0];
      const lat = Number(v?.location?.latitude);
      const lng = Number(v?.location?.longitude);
      const img = (e.images ?? []).filter((i) => i.ratio === "16_9").sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find((i) => (i.width ?? 0) >= 300);
      const c = e.classifications?.[0];
      return {
        id: e.id,
        name: e.name,
        date: e.dates!.start!.localDate!,
        time: e.dates?.start?.localTime?.slice(0, 5),
        venue: v?.name,
        city: v?.city?.name,
        distanceM: Number.isFinite(lat) && Number.isFinite(lng) ? Math.round(distanceM(center, { lat, lng })) : undefined,
        genre: c?.genre?.name && c.genre.name !== "Undefined" ? c.genre.name : undefined,
        segment: c?.segment?.name,
        priceFrom: e.priceRanges?.[0]?.min,
        currency: e.priceRanges?.[0]?.currency,
        image: img?.url,
        url: e.url,
        status: e.dates?.status?.code,
      };
    })
    // the same show on several dates or ticket types comes back as separate events: keep one per name, date and venue
    .filter((e) => {
      const k = `${e.name}|${e.date}|${e.venue}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}
