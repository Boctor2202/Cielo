"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GoogleRoutesMap } from "@/components/app/GoogleRoutesMap";
import { greatCirclePath } from "@cielo/core";
import { PageTitle } from "@/components/app/ui";
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
  const flights = useFlights();
  const airports = useAirports();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [year, setYear] = useState("");
  const locale = useLocale();
  // Google Maps when a browser key is configured, else the built-in vector map
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const [googleFailed, setGoogleFailed] = useState(false);
  const useGoogle = !!googleKey && !googleFailed;
  const { dark, setMode } = useMapTheme();
  const years = useMemo(() => [...new Set((flights ?? []).map((f) => f.date.slice(0, 4)))].sort().reverse(), [flights]);

  const geo = useMemo(() => {
    if (!flights || !airports) return null;
    const routes = new Map<string, { a: string; b: string; n: number }>();
    const used = new Map<string, number>();
    for (const f of flights) {
      if (f.isFstd || (year && !f.date.startsWith(year)) || f.depIcao === f.arrIcao) continue;
      const [a, b] = [f.depIcao, f.arrIcao].sort() as [string, string];
      const k = `${a}-${b}`;
      routes.set(k, { a, b, n: (routes.get(k)?.n ?? 0) + 1 });
      used.set(f.depIcao, (used.get(f.depIcao) ?? 0) + 1);
      used.set(f.arrIcao, (used.get(f.arrIcao) ?? 0) + 1);
    }
    const lines = [...routes.values()].flatMap((r) => {
      const A = airports.get(r.a);
      const B = airports.get(r.b);
      return A && B ? [{ type: "Feature" as const, properties: { n: r.n }, geometry: { type: "LineString" as const, coordinates: greatCirclePath(A, B, 48) } }] : [];
    });
    const points = [...used.entries()].flatMap(([icao, n]) => {
      const A = airports.get(icao);
      return A ? [{ type: "Feature" as const, properties: { icao, n, name: A.name, city: A.city ?? "" }, geometry: { type: "Point" as const, coordinates: [A.lon, A.lat] } }] : [];
    });
    return { lines: { type: "FeatureCollection" as const, features: lines }, points: { type: "FeatureCollection" as const, features: points } };
  }, [flights, airports, year]);

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

  return (
    <>
      <PageTitle
        title={t("title")}
        subtitle={geo ? `${t("routes", { count: geo.lines.features.length })} · ${t("airports", { count: geo.points.features.length })}` : "…"}
        actions={
          <>
            <MapThemeToggle dark={dark} onChange={(d) => setMode(d ? "dark" : "light")} />
            <select className="input !w-auto" value={year} onChange={(e) => setYear(e.target.value)} aria-label={t("filterYear")}>
              <option value="">{tl("allYears")}</option>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </>
        }
      />
      {useGoogle ? (
        <GoogleRoutesMap apiKey={googleKey!} lang={locale} dark={dark} lines={geo?.lines} points={geo?.points} onError={() => setGoogleFailed(true)} />
      ) : (
        <div ref={ref} className="h-[calc(100dvh-220px)] min-h-[420px] overflow-hidden rounded-xl border border-border" />
      )}
    </>
  );
}
