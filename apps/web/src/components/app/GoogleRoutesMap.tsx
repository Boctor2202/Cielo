"use client";

import { useEffect, useRef } from "react";

/**
 * Routes and airports on a Google map (Maps JavaScript API, browser key restricted to this site).
 * Google draws its own logo and attribution, as its terms require.
 */

type Lines = { type: "FeatureCollection"; features: { type: "Feature"; properties: { n: number }; geometry: { type: "LineString"; coordinates: number[][] } }[] };
type Points = { type: "FeatureCollection"; features: { type: "Feature"; properties: { icao: string; n: number }; geometry: { type: "Point"; coordinates: number[] } }[] };

// Minimal typing of the parts of google.maps used here
type GMap = {
  data: {
    addGeoJson: (g: unknown) => unknown[];
    forEach: (cb: (f: unknown) => void) => void;
    remove: (f: unknown) => void;
    setStyle: (fn: (f: { getProperty: (k: string) => unknown; getGeometry: () => { getType: () => string } }) => unknown) => void;
    addListener: (ev: string, cb: (e: { feature: { getProperty: (k: string) => unknown; getGeometry: () => { getType: () => string } }; latLng: unknown }) => void) => void;
  };
  fitBounds: (b: unknown, pad?: number) => void;
};
type GoogleNS = {
  maps: {
    Map: new (el: HTMLElement, o: Record<string, unknown>) => GMap;
    LatLngBounds: new () => { extend: (p: { lat: number; lng: number }) => void };
    InfoWindow: new () => { setContent: (c: string) => void; setPosition: (p: unknown) => void; open: (o: { map: GMap }) => void; close: () => void };
    SymbolPath: { CIRCLE: number };
    Point: new (x: number, y: number) => unknown;
  };
};

let loader: Promise<unknown> | null = null;
export function loadGoogle<G = GoogleNS>(key: string, lang: string): Promise<G> {
  const w = window as unknown as { google?: GoogleNS; __geardownMapsReady?: () => void };
  if (w.google?.maps) return Promise.resolve(w.google as G);
  if (!loader)
    loader = new Promise((resolve, reject) => {
      w.__geardownMapsReady = () => resolve(w.google!);
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=${lang}&callback=__geardownMapsReady&loading=async`;
      s.async = true;
      s.onerror = () => {
        loader = null;
        reject(new Error("Google Maps failed to load"));
      };
      document.head.appendChild(s);
    });
  return loader as Promise<G>;
}

// Night style (classic styles array, no Map ID needed)
export const NIGHT = [
  { elementType: "geometry", stylers: [{ color: "#13263f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1626" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#93a6bc" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#25406a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1c3352" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5d73" }] },
];
export const DAY = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
];

export function GoogleRoutesMap({ apiKey, lang, dark, lines, points, onError }: { apiKey: string; lang: string; dark: boolean; lines?: Lines; points?: Points; onError: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<GMap | null>(null);
  const g = useRef<GoogleNS | null>(null);
  // always draw the latest data, whichever arrives last (the data or the map)
  const data = useRef({ lines, points });
  data.current = { lines, points };

  useEffect(() => {
    let alive = true;
    // Google calls this when the key is refused (wrong key, site not allowed, API not enabled)
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => alive && onError();
    loadGoogle(apiKey, lang)
      .then((google) => {
        if (!alive || !el.current) return;
        g.current = google;
        const m = new google.maps.Map(el.current, {
          center: { lat: 46, lng: 5 },
          zoom: 4,
          styles: dark ? NIGHT : DAY,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          backgroundColor: dark ? "#0a1626" : "#e9eef3",
        });
        const accent = dark ? "#22d3ee" : "#0891b2";
        m.data.setStyle((f) => {
          if (f.getGeometry().getType() === "LineString") {
            const n = Number(f.getProperty("n")) || 1;
            return { strokeColor: accent, strokeOpacity: 0.8, strokeWeight: Math.min(4, 1.2 + Math.log2(n)), clickable: false };
          }
          const n = Number(f.getProperty("n")) || 1;
          // inline SVG dot: nothing to download, sized by the number of visits
          const r = Math.round(Math.min(9, 4 + Math.log2(n)));
          const d = r * 2 + 4;
          const fill = dark ? "#e8eef5" : "#0e2a47";
          const ring = dark ? "#0a1626" : "#ffffff";
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${r}" fill="${fill}" stroke="${ring}" stroke-width="2"/></svg>`;
          return {
            icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new google.maps.Point(d / 2, d / 2) },
            title: `${f.getProperty("icao")} · ${n}`,
          };
        });
        const info = new google.maps.InfoWindow();
        m.data.addListener("click", (e) => {
          if (e.feature.getGeometry().getType() !== "Point") return;
          info.setContent(`<strong>${String(e.feature.getProperty("icao"))}</strong><br/>${String(e.feature.getProperty("n"))} ✈`);
          info.setPosition(e.latLng);
          info.open({ map: m });
        });
        map.current = m;
        draw();
      })
      .catch(() => alive && onError());
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, lang, dark]);

  const draw = () => {
    const m = map.current;
    const google = g.current;
    const { lines, points } = data.current;
    if (!m || !google || !lines || !points) return;
    m.data.forEach((f) => m.data.remove(f));
    m.data.addGeoJson(lines);
    m.data.addGeoJson(points);
    if (points.features.length > 1) {
      const b = new google.maps.LatLngBounds();
      for (const p of points.features) b.extend({ lat: p.geometry.coordinates[1]!, lng: p.geometry.coordinates[0]! });
      m.fitBounds(b, 60);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [lines, points]);

  return <div ref={el} className="h-[calc(100dvh-220px)] min-h-[420px] overflow-hidden rounded-xl border border-border" />;
}
