"use client";

import { useEffect, useRef } from "react";
import { clockIn, formatOffset, zoneOffsetMin } from "@cielo/core";
import { DAY, NIGHT, loadGoogle } from "./GoogleRoutesMap";

/**
 * The time zones on a Google map you can zoom: one polygon per standard UTC offset (traced from
 * timezone-boundary-builder), the night side right now, the pilot's airports; a click gives the local time.
 */
type Feature = { getProperty: (k: string) => unknown; getGeometry: () => { getType: () => string } };
type GMap = {
  data: {
    addGeoJson: (g: unknown) => unknown[];
    setStyle: (fn: (f: Feature) => unknown) => void;
    addListener: (ev: string, cb: (e: { feature: Feature; latLng: { lat: () => number; lng: () => number } }) => void) => void;
    remove: (f: unknown) => void;
  };
  addListener: (ev: string, cb: (e: { latLng: { lat: () => number; lng: () => number } }) => void) => void;
};
type G = {
  maps: {
    Map: new (el: HTMLElement, o: Record<string, unknown>) => GMap;
    InfoWindow: new (o?: Record<string, unknown>) => { setContent: (c: string) => void; setPosition: (p: unknown) => void; open: (o: { map: GMap }) => void };
    Point: new (x: number, y: number) => unknown;
  };
};

const colour = (offsetMin: number, dark: boolean) => {
  const h = offsetMin / 60;
  const hue = (((h + 12) / 26) * 300 + 190) % 360;
  const even = Math.round(h) % 2 === 0;
  return `hsl(${hue.toFixed(0)} ${dark ? 55 : 60}% ${dark ? (even ? 55 : 45) : even ? 50 : 40}%)`;
};

export function TimezoneGoogleMap({
  apiKey,
  lang,
  dark,
  night,
  places,
  zoneAt,
  onError,
}: {
  apiKey: string;
  lang: string;
  dark: boolean;
  /** the night side as [lon, lat] points of a closed ring */
  night: number[][];
  places: { icao: string; lat: number; lon: number; zone?: string; base?: boolean }[];
  zoneAt: (lat: number, lon: number) => string | undefined;
  onError: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<GMap | null>(null);
  const nightFeatures = useRef<unknown[]>([]);
  const latest = useRef({ night, places });
  latest.current = { night, places };

  useEffect(() => {
    let alive = true;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => alive && onError();
    Promise.all([loadGoogle<G>(apiKey, lang), fetch("/data/timezones.geojson").then((r) => r.json())])
      .then(([google, zones]) => {
        if (!alive || !el.current) return;
        const m = new google.maps.Map(el.current, {
          center: { lat: 30, lng: 10 },
          zoom: 2,
          minZoom: 2,
          styles: dark ? NIGHT : DAY,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          backgroundColor: dark ? "#0a1626" : "#e9eef3",
        });
        map.current = m;
        m.data.addGeoJson(zones);
        m.data.addGeoJson({
          type: "FeatureCollection",
          features: latest.current.places.map((p) => ({ type: "Feature", properties: { icao: p.icao, base: !!p.base, zone: p.zone ?? "" }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })),
        });
        nightFeatures.current = m.data.addGeoJson({ type: "Feature", properties: { night: true }, geometry: { type: "Polygon", coordinates: [latest.current.night] } });
        m.data.setStyle((f) => {
          const type = f.getGeometry().getType();
          if (f.getProperty("night")) return { fillColor: "#020617", fillOpacity: 0.35, strokeWeight: 0, clickable: false, zIndex: 2 };
          if (type === "Point") {
            const base = !!f.getProperty("base");
            const r = base ? 6 : 4.5;
            const d = r * 2 + 4;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${r}" fill="${base ? "#22c55e" : "#ffffff"}" stroke="#020617" stroke-width="2"/></svg>`;
            return { icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new google.maps.Point(d / 2, d / 2) }, title: String(f.getProperty("icao")), zIndex: 3 };
          }
          const o = Number(f.getProperty("offset"));
          return { fillColor: colour(o, dark), fillOpacity: dark ? 0.32 : 0.28, strokeColor: dark ? "#cbd5e1" : "#334155", strokeOpacity: 0.55, strokeWeight: 0.8, zIndex: 1 };
        });
        const info = new google.maps.InfoWindow({ headerDisabled: true });
        const show = (lat: number, lng: number, title?: string, zone?: string) => {
          const z = zone || zoneAt(lat, lng);
          if (!z) return;
          const now = new Date();
          const fg = "#0f172a";
          info.setContent(
            `<div style="font:600 13px system-ui;color:${fg};padding:2px 4px">${title ? `<div style="font-weight:800">${title}</div>` : ""}<div style="font-size:22px;font-weight:800">${clockIn(z, now)}</div><div style="color:#475569">${formatOffset(zoneOffsetMin(z, now))} · ${z.replace(/_/g, " ")}</div></div>`,
          );
          info.setPosition({ lat, lng });
          info.open({ map: m });
        };
        m.data.addListener("click", (e) => show(e.latLng.lat(), e.latLng.lng(), (e.feature.getProperty("icao") as string) || undefined, (e.feature.getProperty("zone") as string) || undefined));
        m.addListener("click", (e) => show(e.latLng.lat(), e.latLng.lng()));
      })
      .catch(() => alive && onError());
    return () => {
      alive = false;
    };
    // the map is built once; the night layer follows the clock below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, lang, dark]);

  // the night side moves with the clock
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const f of nightFeatures.current) m.data.remove(f);
    nightFeatures.current = m.data.addGeoJson({ type: "Feature", properties: { night: true }, geometry: { type: "Polygon", coordinates: [night] } });
  }, [night]);

  return <div ref={el} className="h-[min(70vh,640px)] w-full" />;
}
