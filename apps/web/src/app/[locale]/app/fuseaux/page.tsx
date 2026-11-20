"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clockIn, formatOffset, nightPath, timezoneMap, zoneOffsetMin, type TimezoneMapData } from "@cielo/core";
import data from "@cielo/reference-data/timezones.json";
import { Card, PageTitle } from "@/components/app/ui";
import { useAirports } from "@/lib/airports";
import { useFlights, usePilot } from "@/lib/hooks";

const MAP = timezoneMap(data as TimezoneMapData);
const OFFSETS = Array.from({ length: 24 }, (_, i) => i - 11);

/** The world's time zones: the map by UTC offset, the night side right now, and the pilot's airports with their local time. */
export default function TimezonesPage() {
  const t = useTranslations("app.timezones");
  const locale = useLocale();
  const airports = useAirports();
  const flights = useFlights();
  const pilot = usePilot();
  const [now, setNow] = useState<Date | null>(null);
  const [picked, setPicked] = useState<{ x: number; y: number; zone: string } | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // the pilot's airports: home base first, then where they flew last
  const places = useMemo(() => {
    if (!airports) return [];
    const codes: string[] = [];
    if (pilot?.homeBaseIcao) codes.push(pilot.homeBaseIcao);
    for (const f of flights ?? []) {
      for (const c of [f.arrIcao, f.depIcao]) if (c && !codes.includes(c)) codes.push(c);
      if (codes.length >= 8) break;
    }
    return codes.map((c) => airports.get(c)).filter((a): a is NonNullable<typeof a> => !!a && !!a.timezone);
  }, [airports, flights, pilot?.homeBaseIcao]);

  if (!now) return <PageTitle title={t("title")} />;
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const W = 360;
  const H = MAP.span;

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { k: "UTC", v: clockIn("UTC", now), s: "" },
          { k: t("local"), v: clockIn(undefined, now), s: `${local.split("/").pop()?.replace(/_/g, " ")} · ${formatOffset(zoneOffsetMin(local, now))}` },
        ].map((c) => (
          <span key={c.k} className="flex items-baseline gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-1.5">
            <span className="mono-label !text-[10px]">{c.k}</span>
            <span className="num text-lg font-bold">{c.v}</span>
            {c.s && <span className="text-xs text-muted">{c.s}</span>}
          </span>
        ))}
      </div>

      <Card pad={false}>
        <div className="relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/data/timezones.png" alt={t("mapAlt")} className="block w-full select-none" draggable={false} />
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full cursor-crosshair"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - r.left) / r.width) * W;
              const y = ((e.clientY - r.top) / r.height) * H;
              const zone = MAP.zoneAt(MAP.north - y, x - 180);
              setPicked(zone ? { x, y, zone } : null);
            }}
          >
            <path d={MAP.land} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={0.18} />
            <path d={nightPath(now, MAP.north, MAP.south)} fill="rgba(2,6,23,.42)" />
            {/* the hour of each offset band, along the top */}
            {OFFSETS.map((o) => (
              <text key={o} x={o * 15 + 180} y={5.5} textAnchor="middle" fontSize={3.6} fontWeight={700} fill="#fff" opacity={0.85}>
                {clockIn(`Etc/GMT${o > 0 ? "-" : "+"}${Math.abs(o)}`, now)}
              </text>
            ))}
            {places.map((a, i) => {
              const p = MAP.xy(a.lat, a.lon);
              return (
                <g key={a.icao}>
                  <circle cx={p.x} cy={p.y} r={i === 0 ? 1.6 : 1.1} fill={i === 0 ? "#22c55e" : "#fff"} stroke="#020617" strokeWidth={0.4} />
                  {/* labels for the home base and the airports far enough from it, so they never pile up */}
                  {(i === 0 || places.slice(0, i).every((b) => Math.hypot(MAP.xy(b.lat, b.lon).x - p.x, MAP.xy(b.lat, b.lon).y - p.y) > 9)) && (
                    <text x={p.x + 2} y={p.y + 1.2} fontSize={3} fontWeight={700} fill="#fff" stroke="#020617" strokeWidth={0.5} paintOrder="stroke">
                      {a.icao} {clockIn(a.timezone, now)}
                    </text>
                  )}
                </g>
              );
            })}
            {picked && (
              <g>
                <circle cx={picked.x} cy={picked.y} r={1.2} fill="#fbbf24" stroke="#020617" strokeWidth={0.4} />
                <text x={Math.min(picked.x + 2, W - 60)} y={Math.max(picked.y - 2, 8)} fontSize={3.4} fontWeight={700} fill="#fbbf24" stroke="#020617" strokeWidth={0.6} paintOrder="stroke">
                  {clockIn(picked.zone, now)} · {formatOffset(zoneOffsetMin(picked.zone, now))} · {picked.zone.replace(/_/g, " ")}
                </text>
              </g>
            )}
          </svg>
        </div>
        <p className="px-5 py-3 text-xs text-muted">{t("legend")}</p>
      </Card>

      {places.length > 0 && (
        <Card title={t("airports")} className="mt-4">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {places.map((a, i) => (
              <li key={a.icao} className="rounded-xl border border-border bg-surface-2/50 px-4 py-3">
                <p className="flex items-center justify-between gap-2 text-sm">
                  <span className="num font-bold">{a.icao}</span>
                  {i === 0 && pilot?.homeBaseIcao === a.icao && <span className="text-xs font-semibold text-accent">{t("base")}</span>}
                </p>
                <p className="truncate text-xs text-muted">{a.city || a.name}</p>
                <p className="num mt-1 text-2xl font-bold">{clockIn(a.timezone, now)}</p>
                <p className="text-xs text-muted">{formatOffset(zoneOffsetMin(a.timezone!, now))}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="mt-3 text-[11px] text-muted">{(data as TimezoneMapData).attribution}</p>
    </>
  );
}
