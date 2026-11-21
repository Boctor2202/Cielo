"use client";

/* eslint-disable @next/next/no-img-element -- Google's photo is shown from Google's URL, unmodified and unstored */
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CityPhoto as Photo } from "@/lib/server/cityPhoto";

const cache = new Map<string, Photo | null>();
const pickKey = (icao: string) => `geardown-cityphoto-${icao}`;
const readPick = (icao: string) => {
  try {
    return Number(localStorage.getItem(pickKey(icao))) || 0;
  } catch {
    return 0;
  }
};

/**
 * A photo of the layover's city (its best-known landmark, from Google), as a banner: the landmark's name, the
 * photographer's credit as Google asks, and "another picture". Nothing when Google has no photo.
 */
export function CityPhoto({ icao, className = "", height = 140 }: { icao: string; className?: string; height?: number }) {
  const t = useTranslations("app.layovers");
  const locale = useLocale();
  const [n, setN] = useState(0);
  const [photo, setPhoto] = useState<Photo | null | undefined>(undefined);
  useEffect(() => setN(readPick(icao)), [icao]);
  useEffect(() => {
    const k = `${icao}|${n}|${locale}`;
    if (cache.has(k)) return setPhoto(cache.get(k));
    let alive = true;
    fetch(`/api/city-photo?icao=${icao}&lang=${locale === "fr" ? "fr" : "en"}&n=${n}`)
      .then((r) => (r.ok ? r.json() : { photo: null }))
      .then((d: { photo: Photo | null }) => {
        cache.set(k, d.photo);
        if (alive) setPhoto(d.photo);
      })
      .catch(() => alive && setPhoto(null));
    return () => {
      alive = false;
    };
  }, [icao, n, locale]);
  if (photo === null) return null;
  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const v = n + 1;
    setN(v);
    try {
      localStorage.setItem(pickKey(icao), String(v));
    } catch {
      /* kept for this visit only */
    }
  };
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-sky-900/60 via-slate-900/70 to-emerald-900/40 ${className}`} style={{ height }}>
      {photo ? <img src={photo.url} alt={photo.landmark} className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" /> : <div className="h-full w-full animate-pulse" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/70" />
      {photo ? (
        <>
          <span className="absolute bottom-2 left-3 text-sm font-semibold text-white drop-shadow">{photo.landmark}</span>
          <span className="absolute right-2 top-2 flex items-center gap-1">
            {photo.count > 1 ? (
              <button type="button" onClick={next} title={t("otherPhoto")} aria-label={t("otherPhoto")} className="grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70">
                <RefreshCw size={13} />
              </button>
            ) : null}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (photo.authorUri) window.open(photo.authorUri, "_blank", "noopener");
            }}
            className="absolute bottom-2 right-3 text-[10px] text-white/80 hover:underline"
          >
            {t("photoCredit", { name: photo.author || "Google" })}
          </button>
        </>
      ) : null}
    </div>
  );
}
