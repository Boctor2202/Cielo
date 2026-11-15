"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- google.maps is loaded at runtime, typed loosely here */
import { Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { LiveAircraft, Track } from "@/lib/adsb";
import { DAY, NIGHT, loadGoogle } from "./GoogleRoutesMap";

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

export function RadarMap({ apiKey, lang, dark, myRegs, onError }: { apiKey: string; lang: string; dark: boolean; myRegs: string[]; onError: () => void }) {
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
          center: { lat: 48.7, lng: 2.4 },
          zoom: 7,
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
        m.addListener("idle", () => {
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
