"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Footprints, MapPin, Star } from "lucide-react";
import type { Place } from "@/lib/places";
import { BrowserFrame, Shot } from "./Shot";

const photo = (p: Place) => `/api/escale/photo?name=${encodeURIComponent(p.photo!.name)}`;
const ease = [0.22, 1, 0.36, 1] as const;

/**
 * The layover feature, live: the best-rated restaurants around a Lisbon layover with their Google photos, one
 * after the other, as the app shows them. Loaded only when the section comes into view; the screenshot stands in
 * when Google cannot be reached.
 */
export function LayoverShowcase({ alt }: { alt: string }) {
  const t = useTranslations("features.layShow");
  const locale = useLocale();
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "200px 0px" });
  const visible = useInView(ref, { margin: "-20% 0px" });
  const [places, setPlaces] = useState<Place[] | null | "failed">(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    fetch(`/api/escale/showcase?lang=${locale === "fr" ? "fr" : "en"}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ places: Place[] }>) : Promise.reject()))
      .then((d) => alive && setPlaces(d.places.length >= 3 ? d.places : "failed"))
      .catch(() => alive && setPlaces("failed"));
    return () => {
      alive = false;
    };
  }, [seen, locale]);

  const list = Array.isArray(places) ? places : [];
  useEffect(() => {
    if (!list.length || !visible || reduce) return;
    const id = setInterval(() => setI((k) => (k + 1) % list.length), 4500);
    return () => clearInterval(id);
  }, [list.length, visible, reduce]);

  if (places === "failed")
    return (
      <BrowserFrame>
        <Shot name="layovers" alt={alt} className="w-full" />
      </BrowserFrame>
    );

  const p = list[i];
  const walk = (m: number) => (m < 1200 ? t("walk", { min: Math.max(1, Math.round(m / 80)) }) : t("km", { km: (m / 1000).toFixed(1) }));
  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1626] text-white shadow-[0_40px_90px_-30px_rgba(2,6,23,.55)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold"><MapPin size={14} className="text-[#22c55e]" /> {t("where")}</p>
          <p className="text-[11px] text-white/55">{t("what")}</p>
        </div>
        <span className="shrink-0 rounded-full border border-[#22c55e]/50 bg-[#22c55e]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#22c55e]">{t("live")}</span>
      </div>

      {/* the featured place: its photo slowly zooming, the next one fading in */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[#101c2e]">
        {!p && <div className="absolute inset-0 animate-pulse bg-white/5" />}
        <AnimatePresence initial={false}>
          {p && (
            <motion.div key={p.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.9, ease }}>
              <motion.img
                src={photo(p)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ scale: reduce ? 1 : 1.02 }}
                animate={{ scale: reduce ? 1 : 1.14 }}
                transition={{ duration: 6, ease: "linear" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
              <motion.div className="absolute inset-x-4 bottom-3" initial={{ y: reduce ? 0 : 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: reduce ? 0 : 0.25, ease }}>
                <span className="num mb-1.5 inline-grid h-6 min-w-6 place-items-center rounded-full bg-[#f5b301] px-1.5 text-xs font-bold text-black">{i + 1}</span>
                <p className="truncate text-xl font-bold drop-shadow sm:text-2xl">{p.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-white/85">
                  {p.rating !== undefined && (
                    <span className="flex items-center gap-1 font-semibold">
                      <Star size={13} className="fill-[#f5b301] text-[#f5b301]" /> {p.rating.toFixed(1)}
                      <span className="font-normal text-white/65">({(p.reviews ?? 0).toLocaleString(locale)})</span>
                    </span>
                  )}
                  {p.type && <span>{p.type}</span>}
                  <span className="flex items-center gap-1"><Footprints size={13} /> {walk(p.distanceM)}</span>
                </p>
                {p.photo?.author && <p className="mt-1 truncate text-[10px] text-white/55">© {p.photo.author}</p>}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the ranking: every place, the one shown lit, its progress bar running */}
      <ol className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-6">
        {(list.length ? list : Array.from({ length: 6 }, () => null)).map((x, j) => (
          <li key={x?.id ?? j}>
            <button
              type="button"
              disabled={!x}
              onClick={() => setI(j)}
              className={`group relative block aspect-square w-full overflow-hidden rounded-lg border transition-[border-color,opacity] ${j === i && x ? "border-[#22c55e] opacity-100" : "border-white/10 opacity-60 hover:opacity-100"}`}
              aria-label={x?.name}
            >
              {x ? (
                <motion.img src={photo(x)} alt="" loading="lazy" className="h-full w-full object-cover" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: reduce ? 0 : j * 0.08 }} />
              ) : (
                <span className="block h-full w-full animate-pulse bg-white/5" />
              )}
              {x && j === i && !reduce && (
                <motion.span key={`bar-${i}`} className="absolute inset-x-0 bottom-0 h-1 origin-left bg-[#22c55e]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 4.5, ease: "linear" }} />
              )}
            </button>
          </li>
        ))}
      </ol>
      <p className="px-4 pb-3 text-right text-[10px] text-white/45">{t("attribution")}</p>
    </div>
  );
}
