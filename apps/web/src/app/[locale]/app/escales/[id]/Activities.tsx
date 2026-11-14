"use client";

import {
  ExternalLink,
  Footprints,
  Hotel,
  Loader2,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, Segmented } from "@/components/app/ui";
import type { HotelHit, Place, PlaceCategory } from "@/lib/places";
import { Events } from "./Events";

type Cat = PlaceCategory | "events";
const CATS: Cat[] = [
  "events",
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
  const [cat, setCat] = useState<Cat>("events");
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
    if (!center || cat === "events") return;
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

  const list = useMemo(
    () =>
      places
        ? [...places].sort((a, b) =>
            sort === "rating" ? b.score - a.score : a.distanceM - b.distanceM,
          )
        : [],
    [places, sort],
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

          {cat === "events" && center && (
            <Events center={center} from={from} to={to} />
          )}
          {cat !== "events" && (
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

              <ol className="grid gap-2">
                {list.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                  >
                    <span className="num w-6 shrink-0 text-center text-sm font-semibold text-muted">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                        {p.rating !== undefined && (
                          <span className="flex items-center gap-1 font-semibold text-text">
                            <Star
                              size={12}
                              className="fill-[#f5b301] text-[#f5b301]"
                            />{" "}
                            {p.rating.toFixed(1)}
                            <span className="font-normal text-muted">
                              ({(p.reviews ?? 0).toLocaleString(locale)})
                            </span>
                          </span>
                        )}
                        {p.type && <span>{p.type}</span>}
                        {p.priceLevel !== undefined && p.priceLevel > 0 && (
                          <span>{"€".repeat(p.priceLevel)}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Footprints size={12} /> {walk(p.distanceM)}
                        </span>
                        {p.openNow !== undefined && (
                          <span
                            className={p.openNow ? "text-[var(--success)]" : ""}
                          >
                            {p.openNow ? t("open") : t("closed")}
                          </span>
                        )}
                      </p>
                    </div>
                    {p.mapsUrl && (
                      <a
                        href={p.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost shrink-0 !px-2 text-accent"
                        aria-label={t("openMaps", { name: p.name })}
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </li>
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
