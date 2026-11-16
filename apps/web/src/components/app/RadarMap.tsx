"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- google.maps is loaded at runtime, typed loosely here */
import { Loader2, LocateFixed, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { classifyRunwayUse, RunwayUseTracker, runwayUseLabel, type RunwayThreshold, type RunwayUseSummary } from "@cielo/core";
import type { LiveAircraft, Track } from "@/lib/adsb";
import { DAY, NIGHT, loadGoogle } from "./GoogleRoutesMap";
import { WeatherBody, fetchWeather } from "./AirportWeather";

/** Plane silhouette in a 24×24 box, nose up (rotated by the track). */
const PLANE = "M12 1.5c.8 0 1.4 1 1.4 2.4V9l7.6 4.4v2.1l-7.6-2.3v4.9l2.2 1.7v1.7L12 20.6l-3.6.9v-1.7l2.2-1.7v-4.9L3 15.5v-2.1L10.6 9V3.9c0-1.4.6-2.4 1.4-2.4z";

/** Colour by altitude, as on most radar sites (ground grey, then green → yellow → orange → cyan → violet). */
function altColor(alt: LiveAircraft["alt"]) {
  if (alt === "ground" || alt == null) return "#9aa5b1";
  if (alt < 2000) return "#22c55e";
  if (alt < 10000) return "#eab308";
  if (alt < 20000) return "#f97316";
  if (alt < 30000) return "#38bdf8"; // altitude scale (data colours), not the brand accent
  return "#a78bfa";
}

const NM = 1852;
function distNm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3;
  const r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(x))) / NM;
}

const POLL_MS = 15_000;

/** [icao, name, lat, lon, size, elevation ft] — size 3 large, 2 medium, 1 small aerodrome */
type Aerodrome = [string, string, number, number, number, number];
let aerodromes: Promise<Aerodrome[]> | null = null;
/** The airport file the app already ships, reduced to what the map draws (loaded once). */
const loadAerodromes = () =>
  (aerodromes ??= fetch("/data/airports.json")
    .then((r) => r.json())
    .then((d: { rows: (string | number | null)[][] }) => d.rows.map((r) => [r[0], r[2], r[5], r[6], r[9], r[7] ?? 0] as Aerodrome)));
let runwayData: Promise<Record<string, RunwayThreshold[]>> | null = null;
/** Runway thresholds (OurAirports), only the ends whose position is known. */
const loadRunways = () =>
  (runwayData ??= fetch("/data/runways.json")
    .then((r) => r.json())
    .then((d: { airports: Record<string, [string, number, number, number | null, number | null][]> }) => {
      const out: Record<string, RunwayThreshold[]> = {};
      for (const [icao, ends] of Object.entries(d.airports)) {
        const ok = ends.filter((e) => e[3] != null && e[4] != null).map(([ident, headingTrue, lengthFt, lat, lon]) => ({ ident, headingTrue, lengthFt, lat: lat!, lon: lon! }));
        if (ok.length) out[icao] = ok;
      }
      return out;
    })
    .catch(() => ({}) as Record<string, RunwayThreshold[]>));
/** Smallest size shown at a zoom level: large airports from 5, medium from 8, all aerodromes from 10. */
const minSize = (zoom: number) => (zoom >= 10 ? 1 : zoom >= 8 ? 2 : zoom >= 5 ? 3 : 4);

export function RadarMap({ apiKey, lang, dark, myRegs, fallback, onError }: { apiKey: string; lang: string; dark: boolean; myRegs: string[]; fallback?: { lat: number; lng: number }; onError: () => void }) {
  const t = useTranslations("app.radar");
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const g = useRef<any>(null);
  const trail = useRef<any>(null);
  const view = useRef<{ lat: number; lon: number; r: number } | null>(null);
  const [aircraft, setAircraft] = useState<LiveAircraft[]>([]);
  const [selected, setSelected] = useState<LiveAircraft | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "quota" | "error">("loading");
  const [tooWide, setTooWide] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState("");
  const selectedHex = useRef<string | null>(null);
  selectedHex.current = selected?.hex ?? null;
  const [showAirports, setShowAirports] = useState(true);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const me = useRef<any>(null);
  const [locating, setLocating] = useState(false);
  /** Centres the map on the user (the browser asks once); without permission it stays on the home base or Paris. */
  const locate = useCallback((ask: boolean) => {
    if (!("geolocation" in navigator)) return;
    setLocating(ask);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const m = map.current;
        const google = g.current;
        if (!m || !google) return;
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        m.setCenter(pos);
        if (ask) m.setZoom(9);
        me.current?.setMap(null);
        me.current = new google.maps.Marker({ map: m, position: pos, zIndex: 1000, clickable: false, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#3b82f6", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2.5 } });
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);
  // the home base arrives after the map when the airport list loads late
  useEffect(() => {
    if (fallback && map.current && !me.current) map.current.setCenter(fallback);
  }, [fallback]);
  const [airport, setAirport] = useState<{ icao: string; name: string } | null>(null);
  const airportMarkers = useRef<Map<string, any>>(new Map());
  const sizeOf = useRef<Map<string, number>>(new Map());
  /** runway the wind favours (METAR), and runways the traffic is seen using */
  const windRwy = useRef<Map<string, string>>(new Map());
  const tracker = useRef(new RunwayUseTracker());
  const [useTick, setUseTick] = useState(0);
  const trafficOf = (icao: string): RunwayUseSummary | null => tracker.current.summary(icao);
  const labelFor = (icao: string) => {
    const seen = runwayUseLabel(tracker.current.summary(icao));
    const wind = windRwy.current.get(icao);
    return seen ? `${icao} ${seen}` : wind ? `${icao} ≈${wind}` : icao;
  };
  const relabel = useCallback(() => {
    for (const [icao, mk] of airportMarkers.current) {
      const text = labelFor(icao);
      if (mk.getLabel()?.text !== text) mk.setLabel({ ...mk.getLabel(), text });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Airports in view, as small rings labelled with their ICAO code. */
  const drawAirports = useCallback(async () => {
    const m = map.current;
    const google = g.current;
    if (!m || !google) return;
    const shown = airportMarkers.current;
    const b = m.getBounds();
    const size = minSize(m.getZoom() ?? 0);
    const want = new Set<string>();
    if (showAirports && b && size <= 3) {
      for (const [icao, name, lat, lon, sz] of await loadAerodromes()) {
        if (sz < size || !b.contains({ lat, lng: lon })) continue;
        want.add(icao);
        sizeOf.current.set(icao, sz);
        if (want.size > 400) break;
        if (shown.has(icao)) continue;
        shown.set(
          icao,
          new google.maps.Marker({
            map: m,
            position: { lat, lng: lon },
            title: `${icao} · ${name}`,
            zIndex: 0,
            cursor: "pointer",
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: sz === 3 ? 4.5 : 3.5, fillColor: dark ? "#0a1626" : "#ffffff", fillOpacity: 1, strokeColor: dark ? "#e8eef5" : "#0e2a47", strokeWeight: 1.6, labelOrigin: new google.maps.Point(0, 3.4) },
            label: { text: labelFor(icao), fontSize: "10px", fontWeight: "600", color: dark ? "#e8eef5" : "#0e2a47", className: "radar-airport-label" },
          }),
        );
        shown.get(icao).addListener("click", () => {
          setSelected(null);
          setAirport({ icao, name });
        });
      }
    }
    for (const [icao, mk] of shown) {
      if (want.has(icao)) continue;
      mk.setMap(null);
      shown.delete(icao);
    }
    // runway the wind favours, next to the code: METARs of the larger aerodromes in view (40 at most)
    const ids = [...want].filter((i) => (sizeOf.current.get(i) ?? 1) >= 2).sort((a, b) => (sizeOf.current.get(b) ?? 0) - (sizeOf.current.get(a) ?? 0)).slice(0, 40);
    if (!ids.length) return;
    const wx = await fetchWeather(ids, { taf: false });
    for (const icao of ids) {
      const r = wx?.runways?.[icao];
      if (r && !r.calm) windRwy.current.set(icao, r.ident);
    }
    relabel();
  }, [showAirports, dark, relabel]);

  // every traffic update: aircraft low near an aerodrome, lined up with one of its runways
  useEffect(() => {
    let alive = true;
    (async () => {
      const low = aircraft.filter((a) => typeof a.alt === "number" && a.alt < 9000 && a.trk != null);
      if (!low.length) return;
      const [fields, rwys] = await Promise.all([loadAerodromes(), loadRunways()]);
      if (!alive) return;
      const near = fields.filter((f) => f[4] >= 2 && rwys[f[0]] && low.some((a) => Math.abs(a.lat - f[2]) < 0.3 && Math.abs(a.lon - f[3]) < 0.45));
      let changed = false;
      for (const a of low) {
        for (const [icao, , lat, lon, , elev] of near) {
          if (Math.abs(a.lat - lat) > 0.25 || Math.abs(a.lon - lon) > 0.4) continue;
          const use = classifyRunwayUse({ hex: a.hex, lat: a.lat, lon: a.lon, alt: a.alt, trk: a.trk, gs: a.gs, vr: a.vr }, elev, rwys[icao]!);
          if (use) {
            tracker.current.observe(icao, a.hex, use);
            changed = true;
          }
        }
      }
      if (changed) {
        relabel();
        setUseTick((n) => n + 1);
      }
    })();
    return () => {
      alive = false;
    };
  }, [aircraft, relabel]);
  useEffect(() => {
    void drawAirports();
  }, [drawAirports]);
  const drawAirportsRef = useRef(drawAirports);
  drawAirportsRef.current = drawAirports;

  const refresh = useCallback(async () => {
    const v = view.current;
    if (!v || document.hidden) return;
    try {
      const r = await fetch(`/api/radar?lat=${v.lat}&lon=${v.lon}&r=${v.r}`);
      const d = (await r.json()) as { ac?: LiveAircraft[]; error?: string };
      if (!r.ok) return setStatus(d.error === "quota" || r.status === 429 ? "quota" : "error");
      setAircraft(d.ac ?? []);
      setStatus("ok");
      const hex = selectedHex.current;
      if (hex) {
        const now = d.ac?.find((a) => a.hex === hex);
        if (now) setSelected(now);
      }
    } catch {
      setStatus("error");
    }
  }, []);

  // map
  useEffect(() => {
    let alive = true;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => alive && onError();
    loadGoogle<any>(apiKey, lang)
      .then((google) => {
        if (!alive || !el.current) return;
        g.current = google;
        const m = new google.maps.Map(el.current, {
          center: fallbackRef.current ?? { lat: 48.7, lng: 2.4 },
          zoom: 8,
          styles: dark ? NIGHT : DAY,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          backgroundColor: dark ? "#0a1626" : "#e9eef3",
        });
        m.data.setStyle((f: any) => ({
          icon: {
            path: PLANE,
            rotation: Number(f.getProperty("trk")) || 0,
            anchor: new google.maps.Point(12, 12),
            scale: f.getProperty("sel") ? 1.35 : 1,
            fillColor: f.getProperty("sel") ? "#ffffff" : altColor(f.getProperty("alt")),
            fillOpacity: 1,
            strokeColor: dark ? "#0a1626" : "#0e2a47",
            strokeWeight: f.getProperty("sel") ? 2 : 0.8,
          },
          title: [f.getProperty("cs"), f.getProperty("r"), f.getProperty("t")].filter(Boolean).join(" · "),
          zIndex: f.getProperty("sel") ? 999 : 1,
        }));
        m.data.addListener("click", (e: any) => {
          const hex = String(e.feature.getProperty("hex"));
          setSelected((cur) => (cur?.hex === hex ? cur : (e.feature.getProperty("raw") as LiveAircraft)));
        });
        // a new map (theme change): the old airport markers belong to the previous one
        for (const mk of airportMarkers.current.values()) mk.setMap(null);
        airportMarkers.current.clear();
        m.addListener("idle", () => {
          void drawAirportsRef.current();
          const c = m.getCenter();
          const b = m.getBounds();
          if (!c || !b) return;
          const ne = b.getNorthEast();
          const r = distNm({ lat: c.lat(), lng: c.lng() }, { lat: ne.lat(), lng: ne.lng() });
          setTooWide(r > 300);
          // rounded so viewers of the same area share the cached response
          const next = { lat: Math.round(c.lat() * 2) / 2, lon: Math.round(c.lng() * 2) / 2, r: Math.min(250, Math.ceil(r / 25) * 25) };
          const prev = view.current;
          if (!prev || prev.lat !== next.lat || prev.lon !== next.lon || prev.r !== next.r) {
            view.current = next;
            refresh();
          }
        });
        map.current = m;
        locate(false);
      })
      .catch(() => alive && onError());
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, lang, dark]);

  // polling (paused while the tab is hidden)
  useEffect(() => {
    const i = setInterval(refresh, POLL_MS);
    const vis = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [refresh]);

  // aircraft layer
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const list = selected && !aircraft.some((a) => a.hex === selected.hex) ? [...aircraft, selected] : aircraft;
    m.data.forEach((f: any) => m.data.remove(f));
    m.data.addGeoJson({
      type: "FeatureCollection",
      features: list.map((a) => ({
        type: "Feature",
        id: a.hex,
        properties: { hex: a.hex, trk: a.trk, alt: a.alt, cs: a.cs, r: a.r, t: a.t, sel: a.hex === selected?.hex, raw: a },
        geometry: { type: "Point", coordinates: [a.lon, a.lat] },
      })),
    });
  }, [aircraft, selected]);

  // track of the selected aircraft (its current or latest leg), refreshed every minute
  useEffect(() => {
    setTrack(null);
    if (!selected?.hex) return;
    let alive = true;
    const load = () =>
      fetch(`/api/radar/trace?hex=${selected.hex}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Track | null) => alive && setTrack(d ?? { hex: selected.hex, legs: [] }))
        .catch(() => alive && setTrack({ hex: selected.hex, legs: [] }));
    load();
    const i = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, [selected?.hex]);

  useEffect(() => {
    const google = g.current;
    const m = map.current;
    trail.current?.setMap(null);
    trail.current = null;
    const leg = track?.legs.at(-1);
    if (!google || !m || !leg || !selected) return;
    const path = leg.map((p) => ({ lat: p[1], lng: p[2] }));
    path.push({ lat: selected.lat, lng: selected.lon });
    trail.current = new google.maps.Polyline({ path, map: m, geodesic: true, strokeColor: dark ? "#22c55e" : "#16a34a", strokeOpacity: 0.9, strokeWeight: 3, clickable: false, zIndex: 5 });
  }, [track, selected, dark]);

  const findReg = async (reg: string) => {
    const r0 = reg.trim().toUpperCase();
    if (r0.length < 3) return;
    setSearching(true);
    setNotFound("");
    try {
      const r = await fetch(`/api/radar/reg?r=${encodeURIComponent(r0)}`);
      const d = (await r.json()) as { ac?: LiveAircraft[]; error?: string };
      if (r.status === 429 || d.error === "quota") return setStatus("quota");
      const a = d.ac?.[0];
      if (!a) return setNotFound(r0);
      setSelected(a);
      map.current?.panTo({ lat: a.lat, lng: a.lon });
      if ((map.current?.getZoom() ?? 0) < 7) map.current?.setZoom(7);
    } finally {
      setSearching(false);
    }
  };

  const legStart = track?.legs.at(-1)?.[0]?.[0];
  const fmtAlt = (a: LiveAircraft["alt"]) => (a === "ground" ? t("ground") : a == null ? "—" : `${a.toLocaleString(lang)} ft`);

  return (
    <div className="relative">
      <div ref={el} className="h-[calc(100dvh-220px)] min-h-[460px] overflow-hidden rounded-xl border border-border" />

      {/* search + my aircraft */}
      <div className="absolute left-3 top-3 z-10 w-[min(calc(100%-24px),320px)] space-y-2">
        <form
          className="flex items-center gap-2 rounded-xl border border-border bg-bg/95 px-3 py-2 shadow-lg backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            findReg(query);
          }}
        >
          {searching ? <Loader2 size={15} className="animate-spin text-muted" /> : <Search size={15} className="text-muted" />}
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={t("searchReg")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("searchReg")} />
        </form>
        {myRegs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {myRegs.map((r) => (
              <button key={r} type="button" className="rounded-full border border-border bg-bg/95 px-2.5 py-1 text-xs font-medium shadow backdrop-blur hover:border-accent" onClick={() => findReg(r)}>
                {r}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => locate(true)}
          className="flex items-center gap-1 rounded-full border border-border bg-bg/95 px-2.5 py-1 text-xs font-medium shadow backdrop-blur hover:border-accent"
        >
          {locating ? <Loader2 size={12} className="animate-spin" /> : <LocateFixed size={12} />} {t("locate")}
        </button>
        <button
          type="button"
          aria-pressed={showAirports}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium shadow backdrop-blur ${showAirports ? "border-accent bg-accent/15 text-text" : "border-border bg-bg/95 text-muted"}`}
          onClick={() => setShowAirports((v) => !v)}
        >
          {t("airports")}
        </button>
        </div>
        {notFound && <p className="rounded-lg bg-bg/95 px-3 py-2 text-xs text-muted shadow">{t("notAirborne", { reg: notFound })}</p>}
      </div>

      {/* status */}
      <div className="pointer-events-none absolute bottom-8 left-3 z-10 flex flex-col items-start gap-1.5">
        {status === "loading" && <span className="rounded-full bg-bg/90 px-2.5 py-1 text-xs text-muted shadow">{t("loading")}</span>}
        {status === "ok" && <span className="rounded-full bg-bg/90 px-2.5 py-1 text-xs shadow">{t("count", { count: aircraft.length })}</span>}
        {status === "quota" && <span className="rounded-full bg-bg/90 px-2.5 py-1 text-xs text-[var(--warning)] shadow">{t("quota")}</span>}
        {status === "error" && <span className="rounded-full bg-bg/90 px-2.5 py-1 text-xs text-[var(--warning)] shadow">{t("error")}</span>}
        {tooWide && <span className="rounded-full bg-bg/90 px-2.5 py-1 text-xs text-muted shadow">{t("zoomIn")}</span>}
      </div>

      {/* selected aircraft */}
      {airport && !selected && (
        <div className="absolute right-3 top-3 z-10 max-h-[calc(100%-24px)] w-[min(calc(100%-24px),380px)] overflow-auto rounded-xl border border-border bg-bg/95 p-4 shadow-xl backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="num text-lg font-bold leading-tight">{airport.icao}</p>
              <p className="text-sm text-muted">{airport.name}</p>
            </div>
            <button type="button" className="btn btn-ghost !p-1" aria-label={t("close")} onClick={() => setAirport(null)}><X size={16} /></button>
          </div>
          <TrafficRunways summary={trafficOf(airport.icao)} key={useTick} />
          <WeatherBody icao={airport.icao} compact />
          <p className="mt-2 text-[10px] text-muted">aviationweather.gov (NOAA)</p>
        </div>
      )}
      {selected && (
        <div className="absolute right-3 top-3 z-10 w-[min(calc(100%-24px),300px)] rounded-xl border border-border bg-bg/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="num text-lg font-bold leading-tight">{selected.cs ?? selected.r ?? selected.hex.toUpperCase()}</p>
              <p className="text-sm text-muted">{[selected.r, track?.desc ?? selected.t].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" className="btn btn-ghost !p-1" aria-label={t("close")} onClick={() => setSelected(null)}>
              <X size={15} />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Item label={t("altitude")} value={fmtAlt(selected.alt)} />
            <Item label={t("speed")} value={selected.gs != null ? `${selected.gs} kt` : "—"} />
            <Item label={t("vs")} value={selected.vr != null ? `${selected.vr > 0 ? "+" : ""}${selected.vr} ft/min` : "—"} />
            <Item label={t("track")} value={selected.trk != null ? `${selected.trk}°` : "—"} />
            <Item label={t("squawk")} value={selected.sq ?? "—"} />
            <Item label={t("hex")} value={selected.hex.toUpperCase()} />
          </dl>
          <p className="mt-3 text-xs text-muted">
            {track === null
              ? t("trackLoading")
              : legStart
                ? t("trackSince", { time: new Date(legStart * 1000).toISOString().slice(11, 16) })
                : t("noTrack")}
          </p>
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted">
        {t("attribution")}{" "}
        <a className="underline" href="https://www.adsb.lol" target="_blank" rel="noreferrer">
          adsb.lol
        </a>{" "}
        ·{" "}
        <a className="underline" href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
          ODbL 1.0
        </a>
      </p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mono-label !text-[10px]">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}

/** Runways the live traffic was seen landing on and taking off from (last 20 minutes). */
function TrafficRunways({ summary }: { summary: RunwayUseSummary | null }) {
  const t = useTranslations("app.radar");
  const ago = (ms: number) => Math.max(0, Math.round((Date.now() - ms) / 60000));
  const row = (label: string, list: RunwayUseSummary["arr"]) =>
    list.length ? (
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-muted">{label}</span>
        {list.map((e) => (
          <span key={e.ident}>
            <b className="num text-base">{e.ident}</b> <span className="num text-xs text-muted">{t("rwySeen", { n: e.count, min: ago(e.lastAt) })}</span>
          </span>
        ))}
      </p>
    ) : null;
  return (
    <div className="mb-3 space-y-1 rounded-lg border border-border px-3 py-2 text-sm">
      <p className="label-caps">{t("rwyTraffic")}</p>
      {summary ? (
        <>
          {row(t("rwyArr"), summary.arr)}
          {row(t("rwyDep"), summary.dep)}
        </>
      ) : (
        <p className="text-xs text-muted">{t("rwyNone")}</p>
      )}
    </div>
  );
}
