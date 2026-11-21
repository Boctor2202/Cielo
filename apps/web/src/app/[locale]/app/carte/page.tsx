"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GoogleRoutesMap } from "@/components/app/GoogleRoutesMap";
import { encodeShareRoutes, greatCirclePath, createShareLink, routeMapChoices, routeMapFlights, routeMapTotals } from "@cielo/core";
import { Plane, MapPin, Route, Globe2, Share2 } from "lucide-react";
import { prefersNativeShare, ShareSheet } from "@/components/app/ShareSheet";
import { usePilot } from "@/lib/hooks";
import { Modal, PageTitle } from "@/components/app/ui";
import { MapThemeToggle } from "@/components/app/MapThemeToggle";
import { useMapTheme } from "@/lib/mapTheme";
import { useAirports } from "@/lib/airports";
import { useFlights } from "@/lib/hooks";
import { MAP_STYLE_URL } from "@/config/site";
import { currentTheme } from "@/lib/theme";

/** Sober base map from the MapLibre demo tiles (override with NEXT_PUBLIC_MAP_STYLE_URL in production). */
function geardownStyle(dark: boolean): import("maplibre-gl").StyleSpecification {
  const c = dark ? { water: "#0a1626", land: "#13263f", border: "#25406a", text: "#93a6bc" } : { water: "#e9eef3", land: "#ffffff", border: "#c9d3de", text: "#4a5d73" };
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: { base: { type: "vector", url: "https://demotiles.maplibre.org/tiles/tiles.json" } },
    layers: [
      { id: "water", type: "background", paint: { "background-color": c.water } },
      { id: "land", type: "fill", source: "base", "source-layer": "countries", paint: { "fill-color": c.land } },
      { id: "borders", type: "line", source: "base", "source-layer": "countries", paint: { "line-color": c.border, "line-width": 0.7 } },
    ],
  };
}

export default function MapPage() {
  const t = useTranslations("app.map");
  const tl = useTranslations("app.logbook");
  const tb = useTranslations("app.badges");
  const flights = useFlights();
  const airports = useAirports();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [period, setPeriod] = useState("all");
  const [type, setType] = useState("");
  const pilot = usePilot();
  const [preview, setPreview] = useState<{ base: string; text: string; link: string; square: boolean } | null>(null);
  const [sharing, setSharing] = useState(false);
  const locale = useLocale();
  // Google Maps when a browser key is configured, else the built-in vector map
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const [googleFailed, setGoogleFailed] = useState(false);
  const useGoogle = !!googleKey && !googleFailed;
  const { dark, setMode } = useMapTheme();
  const choices = useMemo(() => routeMapChoices(flights ?? []), [flights]);

  const totals = useMemo(() => {
    if (!flights || !airports) return null;
    return routeMapTotals(routeMapFlights(flights, { period, type }), (i) => airports.get(i));
  }, [flights, airports, period, type]);

  const geo = useMemo(() => {
    if (!totals || !airports) return null;
    const used = totals.visits;
    const lines = totals.routes.flatMap((r) => {
      const A = airports.get(r.a);
      const B = airports.get(r.b);
      return A && B ? [{ type: "Feature" as const, properties: { n: r.n }, geometry: { type: "LineString" as const, coordinates: greatCirclePath(A, B, 48) } }] : [];
    });
    const points = [...used.entries()].flatMap(([icao, n]) => {
      const A = airports.get(icao);
      return A ? [{ type: "Feature" as const, properties: { icao, n, name: A.name, city: A.city ?? "" }, geometry: { type: "Point" as const, coordinates: [A.lon, A.lat] } }] : [];
    });
    return { lines: { type: "FeatureCollection" as const, features: lines }, points: { type: "FeatureCollection" as const, features: points } };
  }, [totals, airports]);

  const periodLabel = period === "all" ? "" : period === "12m" ? t("last12") : period;
  /** The map as an image (drawn by the server from the routes and totals), in the share sheet. */
  const share = async () => {
    if (!totals) return;
    setSharing(true);
    const lang = locale === "fr" ? "fr" : "en";
    const q = new URLSearchParams({ type: "map", lang, r: encodeShareRoutes(totals.routes), fl: String(totals.flights), ap: String(totals.airports), nm: String(totals.nm), ct: String(totals.countries), per: periodLabel, ty: type, th: dark ? "" : "light", name: pilot?.fullName ?? "", rank: pilot?.rank ?? "" });
    const base = `/api/share-card?${q}`;
    const text = t("shareText", { fl: totals.flights.toLocaleString(locale), ap: totals.airports, nm: totals.nm.toLocaleString(locale), ct: totals.countries });
    // the public page of this map: its preview is the map image, on every network
    const link = await createShareLink(window.location.origin, lang, q);
    try {
      const blob = await (await fetch(base)).blob();
      const file = new File([blob], "geardown-map.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (prefersNativeShare() && nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} · ${link}` });
        return;
      }
      setPreview({ base, text, link, square: false });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setPreview({ base, text, link, square: false });
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    if (useGoogle || !ref.current || mapRef.current) return;
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !ref.current) return;
      maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      const dark = currentTheme() === "dark";
      const map = new maplibregl.Map({ container: ref.current, style: process.env.NEXT_PUBLIC_MAP_STYLE_URL ? MAP_STYLE_URL : geardownStyle(currentTheme() === "dark"), center: [5, 46], zoom: 3.2, attributionControl: { compact: true } });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addSource("airports", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": dark ? "#22c55e" : "#16a34a", "line-width": ["interpolate", ["linear"], ["get", "n"], 1, 1.2, 30, 3.5], "line-opacity": 0.75 } });
        map.addLayer({ id: "airports", type: "circle", source: "airports", paint: { "circle-radius": ["interpolate", ["linear"], ["get", "n"], 1, 3.5, 100, 8], "circle-color": dark ? "#e8eef5" : "#0e2a47", "circle-stroke-color": dark ? "#0a1626" : "#ffffff", "circle-stroke-width": 2 } });
        map.addLayer({ id: "labels", type: "symbol", source: "airports", layout: { "text-field": ["get", "icao"], "text-font": ["Open Sans Semibold"], "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top" }, paint: { "text-color": dark ? "#e8eef5" : "#0e2a47", "text-halo-color": dark ? "#0a1626" : "#ffffff", "text-halo-width": 1.5 } });
        map.on("mouseenter", "airports", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "airports", () => (map.getCanvas().style.cursor = ""));
        mapRef.current = map;
      });
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [useGoogle]);

  useEffect(() => {
    const apply = () => {
      const map = mapRef.current;
      if (!map || !geo) return;
      (map.getSource("routes") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(geo.lines);
      (map.getSource("airports") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(geo.points);
      const coords = geo.points.features.map((f) => f.geometry.coordinates as [number, number]);
      if (coords.length > 1) {
        const lons = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 60, duration: 0, maxZoom: 8 });
      }
    };
    apply();
    const i = setInterval(() => mapRef.current && (apply(), clearInterval(i)), 300);
    return () => clearInterval(i);
  }, [geo]);

  const chip = (v: string, label: string) => (
    <button key={v} type="button" onClick={() => setPeriod(v)} aria-pressed={period === v} className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${period === v ? "border-accent bg-accent text-white" : "border-border text-muted hover:border-accent hover:text-accent"}`}>
      {label}
    </button>
  );
  const tiles = [
    { icon: Plane, v: totals?.flights, l: t("flights", { count: totals?.flights ?? 0 }) },
    { icon: MapPin, v: totals?.airports, l: t("airportsLabel", { count: totals?.airports ?? 0 }) },
    { icon: Route, v: totals?.nm, l: t("nmFlown") },
    { icon: Globe2, v: totals?.countries, l: t("countries", { count: totals?.countries ?? 0 }) },
  ];

  return (
    <>
      <PageTitle
        title={t("title")}
        subtitle={geo ? t("routes", { count: geo.lines.features.length }) : "…"}
        actions={
          <>
            <MapThemeToggle dark={dark} onChange={(d) => setMode(d ? "dark" : "light")} />
            <button type="button" className="btn btn-primary" onClick={() => void share()} disabled={!totals || !totals.flights || sharing}>
              <Share2 size={15} /> {t("share")}
            </button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chip("all", tl("allYears"))}
        {chip("12m", t("last12"))}
        {choices.years.slice(0, 4).map((y) => chip(y, y))}
        {choices.years.length > 4 ? (
          <select className="input !w-auto !py-1 text-sm" value={choices.years.slice(4).includes(period) ? period : ""} onChange={(e) => e.target.value && setPeriod(e.target.value)} aria-label={t("filterYear")}>
            <option value="">{t("olderYears")}</option>
            {choices.years.slice(4).map((y) => <option key={y}>{y}</option>)}
          </select>
        ) : null}
        {choices.types.length > 1 ? (
          <select className="input ml-auto !w-auto !py-1 text-sm" value={type} onChange={(e) => setType(e.target.value)} aria-label={t("filterType")}>
            <option value="">{t("allTypes")}</option>
            {choices.types.map((x) => <option key={x}>{x}</option>)}
          </select>
        ) : null}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(({ icon: Icon, v, l }) => (
          <div key={l} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Icon size={18} /></span>
            <div className="min-w-0">
              <p className="font-mono text-xl font-bold leading-tight tabular-nums">{v === undefined ? "…" : v.toLocaleString(locale)}</p>
              <p className="truncate text-xs text-muted">{l}</p>
            </div>
          </div>
        ))}
      </div>
      {useGoogle ? (
        <GoogleRoutesMap apiKey={googleKey!} lang={locale} dark={dark} lines={geo?.lines} points={geo?.points} onError={() => setGoogleFailed(true)} />
      ) : (
        <div ref={ref} className="h-[calc(100dvh-320px)] min-h-[420px] overflow-hidden rounded-xl border border-border" />
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={t("shareTitle")}>
        {preview && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[false, true].map((sq) => (
                <button key={String(sq)} type="button" onClick={() => setPreview({ ...preview, square: sq })} className={`rounded-full px-3 py-1 text-xs font-semibold ${preview.square === sq ? "bg-accent text-black" : "border border-border text-muted"}`}>
                  {sq ? tb("fmtSquare") : tb("fmtPortrait")}
                </button>
              ))}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${preview.base}${preview.square ? "&fmt=square" : ""}`} alt={preview.text} className="mx-auto max-h-[55vh] w-auto rounded-xl border border-border" />
            <ShareSheet image={`${preview.base}${preview.square ? "&fmt=square" : ""}`} text={preview.text} link={preview.link} />
          </div>
        )}
      </Modal>
    </>
  );
}
