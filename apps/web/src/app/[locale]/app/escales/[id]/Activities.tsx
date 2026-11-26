"use client";

import {
  Clapperboard,
  Coffee,
  Drama,
  ExternalLink,
  Footprints,
  Hotel,
  Landmark,
  Loader2,
  MapPin,
  Music,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  ThumbsUp,
  Trees,
  Umbrella,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, Segmented } from "@/components/app/ui";
import type { HotelHit, Place, PlaceCategory } from "@/lib/places";
import { apiFetch } from "@/lib/report";

type Cat = PlaceCategory;
const CATS: Cat[] = [
  "restaurants",
  "bars",
  "nightlife",
  "cafes",
  "beaches",
  "culture",
  "shows",
  "cinema",
  "parks",
  "wellness",
  "shopping",
];

type Center = { lat: number; lng: number; label: string; isHotel: boolean };

/**
 * "Things to do" around the crew hotel: the pilot picks the hotel once (its Google place ID is saved with the
 * layover), then each category lists the best-rated places nearby, with walking distance and a Google Maps link.
 */
export function Activities({
  hotelPlaceId,
  airport,
  from,
  to,
}: {
  from: string;
  to: string;
  hotelPlaceId?: string;
  airport?: { lat: number; lon: number; name: string };
}) {
  const t = useTranslations("app.layover.activities");
  const locale = useLocale();
  const [center, setCenter] = useState<Center | null>(null);
  const [cat, setCat] = useState<Cat>("restaurants");
  const [sort, setSort] = useState<"rating" | "distance">("rating");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "error" | "not_configured"
  >("idle");
  const cache = useMemo(() => new Map<string, Place[]>(), []); // this page view only, never stored

  // Where to search from: the saved hotel, else the airport
  useEffect(() => {
    let alive = true;
    if (hotelPlaceId) {
      fetch(
        `/api/escale/hotel?id=${encodeURIComponent(hotelPlaceId)}&lang=${locale}`,
      )
        .then((r) => r.json())
        .then((d: { hotel?: HotelHit; error?: string }) => {
          if (!alive) return;
          if (d.hotel)
            setCenter({
              lat: d.hotel.lat,
              lng: d.hotel.lng,
              label: d.hotel.name,
              isHotel: true,
            });
          else if (d.error === "not_configured") setState("not_configured");
        })
        .catch(() => {});
    } else if (airport)
      setCenter({
        lat: airport.lat,
        lng: airport.lon,
        label: airport.name,
        isHotel: false,
      });
    return () => {
      alive = false;
    };
  }, [hotelPlaceId, airport, locale]);

  useEffect(() => {
    if (!center) return;
    const k = `${center.lat},${center.lng},${cat},${locale}`;
    const hit = cache.get(k);
    if (hit) {
      setPlaces(hit);
      setState("idle");
      return;
    }
    let alive = true;
    setState("loading");
    fetch(
      `/api/escale/places?lat=${center.lat}&lng=${center.lng}&cat=${cat}&lang=${locale}`,
    )
      .then(async (r) => ({
        ok: r.ok,
        d: (await r.json()) as { places?: Place[]; error?: string },
      }))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (ok && d.places) {
          cache.set(k, d.places);
          setPlaces(d.places);
          setState("idle");
        } else
          setState(d.error === "not_configured" ? "not_configured" : "error");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [center, cat, locale, cache]);

  // recommendations of the Geardown members: a count from 2 on, and the pilot's own choice
  const [recs, setRecs] = useState<{ counts: Record<string, number>; mine: Set<string> }>({ counts: {}, mine: new Set() });
  useEffect(() => {
    if (!places?.length) return;
    let alive = true;
    apiFetch(`/api/escale/recs?ids=${places.map((p) => encodeURIComponent(p.id)).join(",")}`)
      .then((r) => r.json() as Promise<{ counts?: Record<string, number>; mine?: string[] }>)
      .then((d) => alive && setRecs({ counts: d.counts ?? {}, mine: new Set(d.mine ?? []) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [places]);
  const recommend = async (id: string) => {
    const on = !recs.mine.has(id);
    const mine = new Set(recs.mine);
    if (on) mine.add(id);
    else mine.delete(id);
    setRecs((r) => ({ ...r, mine }));
    const res = await apiFetch("/api/escale/recs", { method: "POST", body: JSON.stringify({ placeId: id, on }) }).catch(() => null);
    const d = res?.ok ? ((await res.json()) as { count?: number }) : null;
    if (d) setRecs((r) => ({ ...r, counts: { ...r.counts, [id]: d.count ?? 0 } }));
    else setRecs((r) => ({ ...r, mine: recs.mine }));
  };

  const list = useMemo(
    () =>
      places
        ? [...places].sort(
            (a, b) =>
              // places recommended by members first
              Number((recs.counts[b.id] ?? 0) >= 2) - Number((recs.counts[a.id] ?? 0) >= 2) ||
              (sort === "rating" ? b.score - a.score : a.distanceM - b.distanceM),
          )
        : [],
    [places, sort, recs.counts],
  );
  const walk = (m: number) =>
    m < 1200
      ? t("walk", { min: Math.max(1, Math.round(m / 80)) })
      : t("km", { km: (m / 1000).toFixed(1) });

  return (
    <Card
      title={t("title")}
      action={
        center && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            {center.isHotel ? <Hotel size={14} /> : <MapPin size={14} />}
            {t("from", { place: center.label })}
          </span>
        )
      }
    >
      {state === "not_configured" ? (
        <p className="text-muted">{t("notConfigured")}</p>
      ) : (
        <div className="space-y-5">
          {!hotelPlaceId && <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted">{t("pickHotel")}</p>}

          {/* Categories */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CATS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${cat === c ? "border-accent bg-accent/12 text-accent" : "border-border text-muted hover:text-text"}`}
              >
                {t(`cats.${c}`)}
              </button>
            ))}
          </div>

          {(
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {state === "loading"
                    ? t("loading")
                    : places
                      ? t("count", { count: list.length })
                      : ""}
                </p>
                <Segmented
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "rating", label: t("byRating") },
                    { value: "distance", label: t("byDistance") },
                  ]}
                />
              </div>

              {state === "error" && (
                <p className="text-sm text-[var(--warning)]">{t("error")}</p>
              )}

              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((p, i) => (
                  <PlaceCard key={p.id} p={p} rank={i + 1} cat={cat} walk={walk(p.distanceM)} openLabel={p.openNow === undefined ? undefined : p.openNow ? t("open") : t("closed")} mapsLabel={t("openMaps", { name: p.name })} locale={locale} recCount={recs.counts[p.id] ?? 0} recMine={recs.mine.has(p.id)} onRecommend={() => void recommend(p.id)} recLabel={(recs.counts[p.id] ?? 0) >= 2 ? t("recBadge", { count: recs.counts[p.id]! }) : ""} recButton={t(recs.mine.has(p.id) ? "recUndo" : "recDo")} />
                ))}
              </ol>
              {/* Google's terms: Places data shown outside a Google map carries the attribution */}
              {list.length > 0 && (
                <p className="text-right text-[11px] text-muted">
                  {t("attribution")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

const CAT_LOOK: Record<Cat, { icon: LucideIcon; from: string; to: string }> = {
  restaurants: { icon: UtensilsCrossed, from: "#f97316", to: "#be123c" },
  bars: { icon: Wine, from: "#a855f7", to: "#7c2d12" },
  nightlife: { icon: Music, from: "#6366f1", to: "#1e1b4b" },
  cafes: { icon: Coffee, from: "#b45309", to: "#422006" },
  beaches: { icon: Umbrella, from: "#06b6d4", to: "#1d4ed8" },
  culture: { icon: Landmark, from: "#0ea5e9", to: "#334155" },
  shows: { icon: Drama, from: "#ec4899", to: "#581c87" },
  cinema: { icon: Clapperboard, from: "#64748b", to: "#0f172a" },
  parks: { icon: Trees, from: "#22c55e", to: "#14532d" },
  wellness: { icon: Sparkles, from: "#2dd4bf", to: "#155e75" },
  shopping: { icon: ShoppingBag, from: "#f43f5e", to: "#7f1d1d" },
};

/** One place: its Google photo (loaded when the card scrolls into view), rank, rating, and the walk from the hotel. */
function PlaceCard({ p, rank, cat, walk, openLabel, mapsLabel, locale, recCount, recMine, onRecommend, recLabel, recButton }: { p: Place; rank: number; cat: Cat; walk: string; openLabel?: string; mapsLabel: string; locale: string; recCount: number; recMine: boolean; onRecommend: () => void; recLabel: string; recButton: string }) {
  const [failed, setFailed] = useState(false);
  const look = CAT_LOOK[cat];
  const Icon = look.icon;
  const photo = p.photo && !failed ? `/api/escale/photo?name=${encodeURIComponent(p.photo.name)}` : null;
  const body = (
    <>
      <div className="relative aspect-[16/10] overflow-hidden" style={photo ? undefined : { background: `linear-gradient(135deg, ${look.from}, ${look.to})` }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <Icon size={42} className="absolute inset-0 m-auto text-white/80" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className={`num absolute left-2.5 top-2.5 grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold ${rank <= 3 ? "bg-[#f5b301] text-black" : "bg-black/55 text-white backdrop-blur"}`}>{rank}</span>
        {p.rating !== undefined && (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
            <Star size={12} className="fill-[#f5b301] text-[#f5b301]" />
            {p.rating.toFixed(1)}
            <span className="font-normal text-white/70">({(p.reviews ?? 0).toLocaleString(locale)})</span>
          </span>
        )}
        <div className="absolute inset-x-3 bottom-2.5 pr-10">
          {recCount >= 2 && (
            <span className="mb-1 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[#22c55e] px-2 py-0.5 text-[10.5px] font-bold text-[#0a1626]">
              <ThumbsUp size={11} className="shrink-0 fill-current" /> {recLabel}
            </span>
          )}
          <p className="truncate text-base font-bold text-white drop-shadow">{p.name}</p>
          {p.photo?.author && !failed && <p className="truncate text-[10px] text-white/70">© {p.photo.author}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {p.type && <span className="truncate font-medium text-text">{p.type}</span>}
          {p.priceLevel !== undefined && p.priceLevel > 0 && <span>{"€".repeat(p.priceLevel)}</span>}
          <span className="flex items-center gap-1"><Footprints size={12} /> {walk}</span>
          {openLabel && <span className={p.openNow ? "font-medium text-[var(--success)]" : ""}>{openLabel}</span>}
        </span>
        {p.mapsUrl && <ExternalLink size={14} className="shrink-0 text-accent" aria-hidden />}
      </div>
    </>
  );
  return (
    <li className={`group relative min-w-0 overflow-hidden rounded-2xl border bg-surface shadow-sm transition-shadow hover:shadow-md ${recCount >= 2 ? "border-[#22c55e]/60" : "border-border"}`}>
      {p.mapsUrl ? (
        <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={mapsLabel} className="block">{body}</a>
      ) : body}
      {/* the pilot's own recommendation: outside the link to Google Maps */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[16/10]">
        <button
          type="button"
          onClick={onRecommend}
          aria-pressed={recMine}
          aria-label={recButton}
          title={recButton}
          className={`pointer-events-auto absolute bottom-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-colors ${recMine ? "bg-[#22c55e] text-[#0a1626]" : "bg-black/55 text-white hover:bg-black/75"}`}
        >
          <ThumbsUp size={15} className={recMine ? "fill-current" : ""} />
        </button>
      </div>
    </li>
  );
}
