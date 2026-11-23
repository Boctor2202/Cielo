"use client";

import { Loader2, Radar, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import type { FoundFlight } from "@/lib/flightaware";
import { apiFetch } from "@/lib/report";

const hhmm = (iso?: string) => (iso ? iso.slice(11, 16) : undefined);

/**
 * "Fill from FlightAware": finds the aircraft's flights on the flight date (by registration) and copies the
 * actual block and runway times (UTC) and the airports into the form.
 */
export function FlightAwareFill({
  registration,
  date,
  onPick,
  hex,
  prominent = false,
}: {
  prominent?: boolean;
  /** the aircraft's Mode S address when already known (aircraft list), for aircraft missing from the databases */
  hex?: string;
  registration?: string;
  date: string;
  onPick: (f: { date?: string; ident?: string; dep?: string; arr?: string; out?: string; off?: string; on?: string; in?: string }) => void;
}) {
  const t = useTranslations("app.form.flightaware");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error" | "not_configured" | "none" | "signin" | "limit" | "history" | "window" | "unknown">("idle");
  const [flights, setFlights] = useState<FoundFlight[]>([]);
  const ready = !!registration && registration.length >= 3 && !!date;

  const search = async () => {
    setOpen(true);
    setState("loading");
    try {
      const r = await apiFetch(`/api/flight-lookup?reg=${encodeURIComponent(registration!)}&date=${date}${hex ? `&hex=${hex}` : ""}`);
      const d = (await r.json()) as { flights?: FoundFlight[]; error?: string; reason?: string };
      if (r.ok && d.reason === "unknown_aircraft") return setState("unknown");
      if (!r.ok) return setState(d.error === "not_configured" ? "not_configured" : d.error === "signin" ? "signin" : d.error === "rate_limited" ? "limit" : d.error === "history_off" ? "history" : d.error === "adsb_window" ? "window" : "error");
      setFlights(d.flights ?? []);
      setState(d.flights?.length ? "idle" : "none");
    } catch {
      setState("error");
    }
  };

  // the results float above the page (a card's rounded, clipped edges would cut them), under the button
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(380, window.innerWidth - 16);
      const left = Math.max(8, Math.min(prominent ? r.left : r.right - width, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, prominent]);
  // closes with Escape or a click anywhere else
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const down = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!pop.current?.contains(n) && !btn.current?.contains(n)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down);
    };
  }, [open]);

  return (
    <div className="relative">
      <button ref={btn} type="button" className={prominent ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm text-accent"} disabled={!ready} title={ready ? undefined : t("needReg")} onClick={search}>
        <Radar size={15} /> {t("button")}
      </button>
      {open && pos && createPortal(
        <div ref={pop} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }} className="z-[60] max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-bg p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="mono-label !text-[10px]">{t("title", { reg: registration ?? "" })}</p>
            <button type="button" className="btn btn-ghost !p-1" aria-label={t("close")} onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>
          {state === "loading" && (
            <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> {t("loading")}
            </p>
          )}
          {state === "none" && <p className="px-2 py-2 text-sm text-muted">{t("none")}</p>}
          {state === "unknown" && <p className="px-2 py-2 text-sm text-muted">{t("unknownAircraft", { reg: registration ?? "" })}</p>}
          {state === "error" && <p className="px-2 py-2 text-sm text-[var(--warning)]">{t("error")}</p>}
          {state === "not_configured" && <p className="px-2 py-2 text-sm text-muted">{t("notConfigured")}</p>}
          {state === "signin" && <p className="px-2 py-2 text-sm text-muted">{t("signin")}</p>}
          {state === "limit" && <p className="px-2 py-2 text-sm text-muted">{t("limit")}</p>}
          {state === "history" && <p className="px-2 py-2 text-sm text-muted">{t("history")}</p>}
          {state === "window" && <p className="px-2 py-2 text-sm text-muted">{t("window")}</p>}
          {state === "idle" &&
            flights.map((f) => (
              <button
                key={f.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                onClick={() => {
                  onPick({ date: (f.out ?? f.off)?.slice(0, 10), ident: f.flightNumber ?? f.ident, dep: f.dep, arr: f.arr, out: hhmm(f.out), off: hhmm(f.off), on: hhmm(f.on), in: hhmm(f.in) });
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="num block font-semibold">
                    {f.dep ?? "?"} → {f.arr ?? "?"}
                    {(f.out ?? f.off)?.slice(0, 10) !== date && (
                      <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {new Date(`${(f.out ?? f.off)!.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" })}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">{[f.ident, f.aircraftType, f.diverted ? t("diverted") : undefined].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="num shrink-0 text-right text-xs">
                  <span className="block">
                    {hhmm(f.out) ?? "--:--"} – {hhmm(f.in) ?? "--:--"}
                  </span>
                  <span className="block text-muted">
                    {hhmm(f.off) ?? "--:--"} / {hhmm(f.on) ?? "--:--"}
                  </span>
                </span>
              </button>
            ))}
          {state === "idle" && flights.length > 0 && <p className="px-2 pt-1 text-[10px] text-muted">{t(flights[0]?.source === "adsb" ? "attributionAdsb" : "attribution")}</p>}
        </div>,
        document.body,
      )}
    </div>
  );
}
