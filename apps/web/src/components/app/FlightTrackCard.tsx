"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- google.maps is loaded at runtime */
import { Loader2, Route } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import type { Flight, TrackPoint } from "@cielo/core";
import { db } from "@/lib/db";
import { fetchFlightTrack, TRACK_WINDOW_H, type TrackResult } from "@/lib/tracks";
import { currentTheme } from "@/lib/theme";
import { DAY, NIGHT, loadGoogle } from "./GoogleRoutesMap";
import { Card } from "./ui";

const hhmm = (s: number) => new Date(s * 1000).toISOString().slice(11, 16);

/** The real (ADS-B) track of a logged flight: map + altitude profile, or a way to fetch it. */
export function FlightTrackCard({ flight }: { flight: Flight }) {
  const t = useTranslations("app.track");
  const track = useLiveQuery(() => db().t("flight_tracks").get(flight.id), [flight.id]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  if (flight.isFstd) return null;

  const inn = flight.inUtc ?? flight.onUtc;
  const recent = !!inn && Date.now() - Date.parse(inn) < TRACK_WINDOW_H * 3600_000;
  const pts = track && !track.deletedAt ? track.points : null;

  return (
    <Card title={<span className="flex items-center gap-2"><Route size={16} /> {t("title")}</span>} className="mt-6">
      {pts && pts.length > 1 ? (
        <>
          <TrackMap points={pts} />
          <Profile points={pts} />
          <p className="mt-2 text-[11px] text-muted">
            {t("source", { hex: track!.hex.toUpperCase() })}{" "}
            <a className="underline" href="https://www.adsb.lol" target="_blank" rel="noreferrer">adsb.lol</a> · ODbL 1.0
          </p>
        </>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted">{recent ? t("pending") : !flight.registration || !inn ? t("needData") : t("tooOld")}</p>
          {recent && flight.registration && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setResult(await fetchFlightTrack(flight));
                setBusy(false);
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />} {t("fetch")}
            </button>
          )}
          {result && result !== "saved" && result !== "exists" && <p className="text-xs text-[var(--warning)]">{t(`result.${result}`, { reg: flight.registration ?? "" })}</p>}
        </div>
      )}
    </Card>
  );
}

function TrackMap({ points }: { points: TrackPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const locale = useLocale();
  const [failed, setFailed] = useState(!key);

  useEffect(() => {
    if (!key || failed) return;
    let alive = true;
    const dark = currentTheme() === "dark";
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => alive && setFailed(true);
    loadGoogle<any>(key, locale)
      .then((google) => {
        if (!alive || !el.current) return;
        const m = new google.maps.Map(el.current, {
          styles: dark ? NIGHT : DAY,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          backgroundColor: dark ? "#0a1626" : "#e9eef3",
        });
        const path = points.map((p) => ({ lat: p[1], lng: p[2] }));
        new google.maps.Polyline({ path, map: m, geodesic: true, strokeColor: dark ? "#22d3ee" : "#0891b2", strokeOpacity: 0.95, strokeWeight: 3 });
        for (const p of [path[0], path[path.length - 1]])
          new google.maps.Marker({ position: p, map: m, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: dark ? "#e8eef5" : "#0e2a47", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
        const b = new google.maps.LatLngBounds();
        for (const p of path) b.extend(p);
        m.fitBounds(b, 40);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [key, failed, locale, points]);

  if (failed) return <SvgTrack points={points} />;
  return <div ref={el} className="h-72 overflow-hidden rounded-xl border border-border" />;
}

/** Fallback without Google: the track drawn on a plain equirectangular frame. */
function SvgTrack({ points }: { points: TrackPoint[] }) {
  const lats = points.map((p) => p[1]);
  const lons = points.map((p) => p[2]);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const w = Math.max(1e-6, (maxLon - minLon) * k);
  const h = Math.max(1e-6, maxLat - minLat);
  const s = 560 / Math.max(w, h * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${(20 + (p[2] - minLon) * k * s).toFixed(1)},${(20 + (maxLat - p[1]) * s).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${w * s + 40} ${h * s + 40}`} className="h-56 w-full rounded-xl border border-border bg-surface-2">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Altitude over time. */
function Profile({ points }: { points: TrackPoint[] }) {
  const t = useTranslations("app.track");
  const t0 = points[0]![0];
  const t1 = points[points.length - 1]![0];
  const maxAlt = Math.max(1000, ...points.map((p) => p[3] ?? 0));
  const maxGs = Math.max(...points.map((p) => p[4] ?? 0));
  const W = 600;
  const H = 110;
  const x = (s: number) => ((s - t0) / Math.max(1, t1 - t0)) * W;
  const y = (a: number | null) => H - ((a ?? 0) / maxAlt) * (H - 8);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[3]).toFixed(1)}`).join("");
  return (
    <div className="mt-4">
      <div className="mb-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span>{t("window", { from: hhmm(t0), to: hhmm(t1) })}</span>
        <span>{t("maxAlt", { ft: (Math.round(maxAlt / 100) * 100).toLocaleString() })}</span>
        <span>{t("maxGs", { kt: maxGs })}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label={t("profile")}>
        <path d={`${line}L${W},${H}L0,${H}Z`} fill="var(--accent)" opacity={0.15} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
