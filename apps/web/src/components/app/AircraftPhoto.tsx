"use client";

/* eslint-disable @next/next/no-img-element -- the photo must be shown from Planespotters' servers, unmodified */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AircraftPhoto as Photo } from "@/lib/planespotters";
import { useFlags } from "@/lib/flags";
import { useAccess } from "@/lib/access";
import { usePilot } from "@/lib/hooks";
import { isDemoAccount } from "@cielo/core";

const cache = new Map<string, Photo | null>();

/**
 * The Planespotters photo of an exact aircraft: undefined while loading, null when there is none (or photos are
 * off, or the registrations are the demo's fictional ones).
 */
export function useAircraftPhoto(reg: string | undefined, hex?: string | null): Photo | null | undefined {
  const [photo, setPhoto] = useState<Photo | null | undefined>(reg ? cache.get(reg) : null);
  // demo data uses fictional registrations: a real aircraft wearing them would show the wrong photo
  // both hooks always run (a hook behind || ran only sometimes: React stopped the page)
  const access = useAccess();
  const pilot = usePilot();
  const fictional = access.demo || isDemoAccount(pilot?.email);
  useEffect(() => {
    if (fictional || process.env.NEXT_PUBLIC_PLANESPOTTERS !== "1" || !reg || reg.length < 3) return setPhoto(null);
    if (cache.has(reg)) return setPhoto(cache.get(reg));
    setPhoto(undefined); // never show the previous aircraft while the new one loads
    let alive = true;
    fetch(`/api/aircraft-photo?reg=${encodeURIComponent(reg)}${hex ? `&hex=${hex}` : ""}`)
      .then((r) => (r.ok ? r.json() : { photo: null }))
      .then((d: { photo: Photo | null }) => {
        cache.set(reg, d.photo);
        if (alive) setPhoto(d.photo);
      })
      .catch(() => alive && setPhoto(null));
    return () => {
      alive = false;
    };
  }, [reg, hex, fictional]);
  const flags = useFlags();
  return flags.aircraftPhotos ? photo : null;
}

/** Photo of the exact aircraft (by registration), credited to its photographer with a link to Planespotters. */
export function AircraftPhoto({ registration, hex, showEmpty, className = "" }: { registration?: string; hex?: string | null; showEmpty?: boolean; className?: string }) {
  const t = useTranslations("app.photo");
  // wait until the registration stops changing (typed in a form)
  const [reg, setReg] = useState(registration?.trim().toUpperCase());
  useEffect(() => {
    const id = setTimeout(() => setReg(registration?.trim().toUpperCase()), 600);
    return () => clearTimeout(id);
  }, [registration]);
  const photo = useAircraftPhoto(reg, hex);
  const flags = useFlags();
  if (!flags.aircraftPhotos) return null;
  if (photo === null && showEmpty && reg && reg.length >= 4 && cache.has(reg))
    return <p className={`text-xs text-muted ${className}`}>{t("none", { reg })}</p>;
  if (!photo) return null;
  return (
    <figure className={`overflow-hidden rounded-xl ${className}`}>
      <a href={photo.link} target="_blank" rel="noopener" title={t("open")}>
        <img src={photo.src} width={photo.width} height={photo.height} alt={t("alt", { reg: reg ?? "" })} className="block h-auto w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </a>
      <figcaption className="mt-1.5 text-[11px] text-muted">
        {t("credit", { name: photo.photographer })}{" "}
        <a href={photo.link} target="_blank" rel="noopener" className="underline">Planespotters.net</a>
      </figcaption>
    </figure>
  );
}
