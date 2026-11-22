"use client";

import { Loader2, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CrossedAirspace, TrackPoint } from "@cielo/core";
import { apiFetch } from "@/lib/report";

interface Context {
  airspaces: CrossedAirspace[];
  cruise: { altFt: number; trackDeg: number; level?: number; windFrom?: number; windKt?: number; tempC?: number; head?: number; cross?: number } | null;
  missing: string[];
}

/** Colour of an airspace chip by type (controlled, restricted, regions). */
const TONE: Record<string, string> = {
  CTR: "border-[#818cf8]/50 text-[#a5b4fc]",
  ATZ: "border-[#818cf8]/50 text-[#a5b4fc]",
  TMA: "border-[#38bdf8]/50 text-[#7dd3fc]",
  CTA: "border-[#38bdf8]/50 text-[#7dd3fc]",
  R: "border-[#f87171]/50 text-[#fca5a5]",
  P: "border-[#f87171]/50 text-[#fca5a5]",
  D: "border-[#fbbf24]/50 text-[#fcd34d]",
  TRA: "border-[#fbbf24]/50 text-[#fcd34d]",
  TSA: "border-[#fbbf24]/50 text-[#fcd34d]",
  FIR: "border-border text-muted",
  UIR: "border-border text-muted",
};

const hhmm = (s: number) => new Date(s * 1000).toISOString().slice(11, 16);
const limit = (ft: number, ref?: string) => (ft >= 99999 ? "UNL" : ref === "STD" ? `FL${String(Math.round(ft / 100)).padStart(3, "0")}` : ft === 0 && ref === "GND" ? "SFC" : `${ft.toLocaleString("en")} ft${ref === "GND" ? " AGL" : ""}`);

/** The airspaces a logged flight crossed and the wind at cruise, under its track. For information only. */
export function FlightContext({ flightId, points }: { flightId: string; points: TrackPoint[] }) {
  const t = useTranslations("app.track.context");
  const [data, setData] = useState<Context | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const key = `ctx:${flightId}:${points.length}`;
    try {
      const c = sessionStorage.getItem(key);
      if (c) return setData(JSON.parse(c) as Context);
    } catch {}
    apiFetch("/api/flight-context", { method: "POST", body: JSON.stringify({ points }) })
      .then((r) => (r.ok ? (r.json() as Promise<Context>) : Promise.reject(r.status)))
      .then((d) => {
        if (!alive) return;
        setData(d);
        try {
          if (!d.missing.some((m) => m.endsWith("Error"))) sessionStorage.setItem(key, JSON.stringify(d));
        } catch {}
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [flightId, points]);

  if (failed) return null;
  if (!data) return <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> {t("loading")}</p>;
  const c = data.cruise;
  const main = data.airspaces.filter((a) => a.type !== "FIR" && a.type !== "UIR");
  const firs = data.airspaces.filter((a) => a.type === "FIR" || a.type === "UIR");
  const sel = data.airspaces.find((a) => a.id === open);
  return (
    <div className="mt-5 space-y-4 border-t border-border pt-4">
      <div>
        <p className="mono-label">{t("airspaces")}</p>
        {data.missing.includes("airspace") ? (
          <p className="mt-1.5 text-xs text-muted">{t("airspaceSoon")}</p>
        ) : main.length + firs.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted">{data.missing.includes("airspaceError") ? t("error") : t("none")}</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {main.map((a) => (
                <button key={a.id} type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-surface-2 ${TONE[a.type] ?? "border-border"} ${open === a.id ? "bg-surface-2" : ""}`}>
                  {a.name}
                  {a.icaoClass ? ` · ${a.icaoClass}` : ""}
                </button>
              ))}
            </div>
            {sel && (
              <div className="mt-2 rounded-xl border border-border bg-surface-2/50 p-3 text-xs">
                <p className="font-semibold">{sel.name} <span className="font-normal text-muted">· {sel.type}{sel.icaoClass ? ` · ${t("class", { c: sel.icaoClass })}` : ""}</span></p>
                <p className="num mt-1 text-muted">{limit(sel.lowerFt, sel.lowerRef)} – {limit(sel.upperFt, sel.upperRef)} · {t("inside", { from: hhmm(sel.from), to: hhmm(sel.to) })}</p>
                {sel.frequencies?.length ? (
                  <ul className="num mt-2 space-y-0.5">
                    {sel.frequencies.map((f, i) => (
                      <li key={i} className="flex justify-between gap-4"><span>{f.name ?? "—"}</span><b className="text-accent">{f.mhz}</b></li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            {firs.length > 0 && <p className="mt-2 text-xs text-muted">{t("firs")} {firs.map((f) => f.name).join(" → ")}</p>}
          </>
        )}
      </div>

      {c && (
        <div>
          <p className="mono-label flex items-center gap-1.5"><Wind size={12} /> {t("cruise", { fl: `FL${String(Math.round(c.altFt / 100)).padStart(3, "0")}` })}</p>
          {c.windKt == null ? (
            <p className="mt-1.5 text-xs text-muted">{data.missing.includes("windError") ? t("error") : t("windSoon")}</p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile k={t("wind")} v={`${String(c.windFrom).padStart(3, "0")}°/${c.windKt} kt`} />
              <Tile k={c.head! >= 0 ? t("headwind") : t("tailwind")} v={`${Math.abs(c.head!)} kt`} tone={c.head! >= 0 ? "text-[var(--caution)]" : "text-[var(--success)]"} />
              <Tile k={t("crosswind")} v={`${Math.abs(c.cross!)} kt ${c.cross! >= 0 ? t("fromRight") : t("fromLeft")}`} />
              <Tile k={t("oat")} v={`${c.tempC} °C`} />
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] text-muted">{t("disclaimer")}</p>
    </div>
  );
}

function Tile({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2">
      <p className="text-[11px] text-muted">{k}</p>
      <p className={`num font-semibold ${tone}`}>{v}</p>
    </div>
  );
}
