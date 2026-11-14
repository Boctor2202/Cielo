"use client";

import { Check, ChevronDown, Plane, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AIRCRAFT_TYPES } from "@cielo/reference-data";
import { AIRCRAFT_VISUALS } from "@/lib/aircraft-visuals";
import type { HomeAircraft } from "@/lib/home-aircraft";

const HAS_VISUALS = new Set(AIRCRAFT_VISUALS.flatMap((v) => v.match));

/** "You fly the …" chip: shows the aircraft used for the page and lets the visitor pick their own type. */
export function AircraftPicker({ aircraft }: { aircraft: HomeAircraft }) {
  const t = useTranslations("immersive.picker");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toUpperCase();
    const list = AIRCRAFT_TYPES.filter((x) => !s || x.icao.includes(s) || `${x.manufacturer} ${x.model}`.toUpperCase().includes(s));
    // types with dedicated imagery first
    return list.sort((a, b) => Number(HAS_VISUALS.has(b.icao)) - Number(HAS_VISUALS.has(a.icao))).slice(0, 7);
  }, [q]);

  return (
    <div ref={root} className="relative mt-7 max-w-md">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-2 text-left backdrop-blur-md transition-colors duration-200 hover:border-[#22d3ee]/60 hover:bg-white/10"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#22d3ee]/15 text-[#67e8f9]">
          <Plane size={16} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-white/55">
            {aircraft.label ? t("flying") : t("choose")}
            {aircraft.source === "logbook" && <span className="normal-case tracking-normal"> · {t("fromLogbook")}</span>}
          </span>
          {aircraft.label && <span className="block truncate text-[15px] font-semibold">{aircraft.label}</span>}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-white/60 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {aircraft.icao && !aircraft.exact && <p className="mt-2 text-xs text-white/55">{t("generic")}</p>}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-30 rounded-xl border border-white/15 bg-[#03060f]/90 p-2 shadow-2xl backdrop-blur-xl"
          >
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#22d3ee] focus:outline-none"
            />
            <ul role="listbox" className="mt-2 max-h-64 overflow-auto">
              {results.length === 0 && <li className="px-3 py-2 text-sm text-white/50">{t("none")}</li>}
              {results.map((x) => (
                <li key={x.id} role="option" aria-selected={x.icao === aircraft.icao}>
                  <button
                    type="button"
                    onClick={() => {
                      aircraft.choose(x.icao);
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
                  >
                    <span className="num w-12 shrink-0 text-[#67e8f9]">{x.icao}</span>
                    <span className="min-w-0 flex-1 truncate">{x.manufacturer} {x.model}</span>
                    {x.icao === aircraft.icao && <Check size={15} className="text-[#67e8f9]" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
            {aircraft.source === "choice" && (
              <button type="button" onClick={() => (aircraft.choose(null), setOpen(false))} className="mt-1 flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-xs text-white/60 hover:bg-white/10 hover:text-white">
                <RotateCcw size={13} aria-hidden /> {t("reset")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
