"use client";

/* eslint-disable @next/next/no-img-element -- the photo must be shown from Planespotters' servers, unmodified */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AircraftPhoto as Photo } from "@/lib/planespotters";

const cache = new Map<string, Photo | null>();

/** Photo of the exact aircraft (by registration), credited to its photographer with a link to Planespotters. */
export function AircraftPhoto({ registration, className = "" }: { registration?: string; className?: string }) {
  const t = useTranslations("app.photo");
  const reg = registration?.trim().toUpperCase();
  const [photo, setPhoto] = useState<Photo | null | undefined>(reg ? cache.get(reg) : null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PLANESPOTTERS !== "1" || !reg || reg.length < 3) return setPhoto(null);
    if (cache.has(reg)) return setPhoto(cache.get(reg));
    let alive = true;
    fetch(`/api/aircraft-photo?reg=${encodeURIComponent(reg)}`)
      .then((r) => (r.ok ? r.json() : { photo: null }))
      .then((d: { photo: Photo | null }) => {
        cache.set(reg, d.photo);
        if (alive) setPhoto(d.photo);
      })
      .catch(() => alive && setPhoto(null));
    return () => {
      alive = false;
    };
  }, [reg]);
  if (!photo) return null;
  return (
    <figure className={`overflow-hidden rounded-xl ${className}`}>
      <a href={photo.link} target="_blank" rel="noreferrer" title={t("open")}>
        <img src={photo.src} width={photo.width} height={photo.height} alt={t("alt", { reg: reg ?? "" })} className="block h-auto w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </a>
      <figcaption className="mt-1.5 text-[11px] text-muted">
        {t("credit", { name: photo.photographer })}{" "}
        <a href={photo.link} target="_blank" rel="noreferrer" className="underline">Planespotters.net</a>
      </figcaption>
    </figure>
  );
}
