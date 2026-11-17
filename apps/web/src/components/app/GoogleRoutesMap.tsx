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
  addListener: (ev: string, cb: () => void) => void;
};
type GoogleNS = {
  maps: {
    Map: new (el: HTMLElement, o: Record<string, unknown>) => GMap;
    LatLngBounds: new () => { extend: (p: { lat: number; lng: number }) => void };
    InfoWindow: new (o?: Record<string, unknown>) => { setContent: (c: string) => void; setPosition: (p: unknown) => void; open: (o: { map: GMap }) => void; close: () => void };
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
  const cleanup = useRef<(() => void) | null>(null);
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
        const accent = dark ? "#22c55e" : "#16a34a";
        m.data.setStyle((f) => {
          if (f.getGeometry().getType() === "LineString") {
            const n = Number(f.getProperty("n")) || 1;
            return { strokeColor: accent, strokeOpacity: 0.8, strokeWeight: Math.min(4, 1.2 + Math.log2(n)), clickable: false };
          }
          const n = Number(f.getProperty("n")) || 1;
          // inline SVG dot: nothing to download, sized by the number of visits
          // small, fine dots (the routes are the subject); busy airports only slightly larger
          const r = Math.round((Math.min(5.5, 2.5 + Math.log2(n) * 0.6)) * 2) / 2;
          const d = Math.ceil(r * 2 + 3);
          const fill = dark ? "#4ade80" : "#15803d";
          const ring = dark ? "#0a1626" : "#ffffff";
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${r}" fill="${fill}" fill-opacity="0.9" stroke="${ring}" stroke-width="1.5"/></svg>`;
          return {
            icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new google.maps.Point(d / 2, d / 2) },
            title: `${f.getProperty("icao")} · ${n}`,
          };
        });
        // no header row (its empty space and hard-to-see close button): the bubble closes on a click elsewhere
        const info = new google.maps.InfoWindow({ headerDisabled: true });
        m.addListener("click", () => info.close());
        m.addListener("dragstart", () => info.close());
        const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && info.close();
        window.addEventListener("keydown", onKey);
        cleanup.current = () => window.removeEventListener("keydown", onKey);
        m.data.addListener("click", (e) => {
          if (e.feature.getGeometry().getType() !== "Point") return;
          // explicit colours: the bubble is always white, whatever the page theme
          const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
          const p = (k: string) => e.feature.getProperty(k);
          const place = [p("name"), p("city")].filter(Boolean).map(esc).join(" · ");
          const n = Number(p("n")) || 0;
          info.setContent(
            `<div style="color:#0a1626;font:500 13px/1.35 Manrope,system-ui,sans-serif;padding:2px 2px 0;min-width:140px">` +
              `<div style="font:700 15px/1.2 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.02em">${esc(p("icao"))}</div>` +
              (place ? `<div style="color:#4a5d73;margin-top:2px">${place}</div>` : "") +
              `<div style="margin-top:6px;color:#15803d;font-weight:700">${n} ${lang.startsWith("fr") ? (n > 1 ? "passages" : "passage") : n > 1 ? "visits" : "visit"}</div>` +
              `</div>`,
          );
          info.setPosition(e.latLng);
          info.open({ map: m });
        });
        map.current = m;
        draw();
      })
      .catch(() => alive && onError());
    return () => {
      alive = false;
      cleanup.current?.();
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
