"use client";

import { Check, Hotel, Loader2, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { HotelHit } from "@/lib/places";

/**
 * The "Hotel" field itself searches Google: focusing it lists the hotels around the airport, typing narrows
 * the list (debounced), and picking one fills the name, address and phone of the layover.
 */
export function HotelPicker({
  value,
  selected,
  airport,
  onText,
  onPick,
}: {
  value: string;
  /** a hotel was picked from the list (its Google place ID is saved) */
  selected: boolean;
  airport?: { lat: number; lon: number };
  onText: (name: string) => void;
  onPick: (h: HotelHit) => void;
}) {
  const t = useTranslations("app.layover.hotelPicker");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<HotelHit[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "not_configured">("idle");
  const [active, setActive] = useState(-1);
  const nearby = useRef<HotelHit[] | null>(null);
  const typed = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const near = airport ? `&lat=${airport.lat}&lng=${airport.lon}` : "";
    const q = value.trim();
    // empty (or untouched) field: hotels around the airport
    if (!typed.current || q.length < 2) {
      if (!airport) return;
      if (nearby.current) {
        setHits(nearby.current);
        return;
      }
      setState("loading");
      fetch(`/api/escale/hotel?near=1${near}&lang=${locale}`)
        .then(async (r) => ({ ok: r.ok, d: (await r.json()) as { hotels?: HotelHit[]; error?: string } }))
        .then(({ ok, d }) => {
          if (ok && d.hotels) {
            nearby.current = d.hotels;
            setHits(d.hotels);
            setState("idle");
          } else setState(d.error === "not_configured" ? "not_configured" : "error");
        })
        .catch(() => setState("error"));
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setState("loading");
      fetch(`/api/escale/hotel?q=${encodeURIComponent(q)}${near}&lang=${locale}`)
        .then(async (r) => ({ ok: r.ok, d: (await r.json()) as { hotels?: HotelHit[]; error?: string } }))
        .then(({ ok, d }) => {
          if (!alive) return;
          if (ok && d.hotels) {
            setHits(d.hotels);
            setState("idle");
          } else setState(d.error === "not_configured" ? "not_configured" : "error");
        })
        .catch(() => alive && setState("error"));
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, value, airport, locale]);

  // close when clicking elsewhere
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (h: HotelHit) => {
    onPick(h);
    typed.current = false;
    setOpen(false);
    setActive(-1);
  };
  const dist = (m?: number) => (m === undefined ? "" : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <Hotel size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="hotel-name"
          className="input !pl-9 !pr-9"
          role="combobox"
          aria-expanded={open}
          aria-controls="hotel-list"
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={t("placeholder")}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            typed.current = true;
            onText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (!hits?.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && open && active >= 0) {
              e.preventDefault();
              pick(hits[active]!);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        {state === "loading" ? (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />
        ) : (
          selected && <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--success)]" aria-label={t("linked")} />
        )}
      </div>
      {open && (
        <div id="hotel-list" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-bg p-1 shadow-2xl">
          {state === "not_configured" && <p className="px-3 py-2 text-sm text-muted">{t("notConfigured")}</p>}
          {state === "error" && <p className="px-3 py-2 text-sm text-[var(--warning)]">{t("error")}</p>}
          {state !== "not_configured" && hits && hits.length === 0 && <p className="px-3 py-2 text-sm text-muted">{t("none")}</p>}
          {!typed.current && hits && hits.length > 0 && <p className="mono-label px-3 pb-1 pt-2 !text-[10px]">{t("nearAirport")}</p>}
          {hits?.map((h, i) => (
            <button
              key={h.id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(h)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left ${i === active ? "bg-accent/12" : "hover:bg-surface-2"}`}
            >
              <Hotel size={16} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{h.name}</span>
                <span className="block truncate text-xs text-muted">{h.address}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted">
                {h.rating !== undefined && (
                  <span className="flex items-center justify-end gap-1 font-semibold text-text">
                    <Star size={11} className="fill-[#f5b301] text-[#f5b301]" /> {h.rating.toFixed(1)}
                  </span>
                )}
                {dist(h.distanceM)}
              </span>
            </button>
          ))}
          {hits && hits.length > 0 && <p className="px-3 pb-1 pt-2 text-right text-[10px] text-muted">{t("attribution")}</p>}
        </div>
      )}
    </div>
  );
}
