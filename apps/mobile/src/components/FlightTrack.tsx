import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { API_URL } from "../api";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { CrossedAirspace, FlightTrack as Track, TrackPoint } from "@cielo/core";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Card, Row, Stat, Txt } from "./ui";

const hhmm = (s: number) => new Date(s * 1000).toISOString().slice(11, 16);

/** The real ADS-B track saved with a logged flight (fetched by the web app while adsb.lol still had it). */
export function FlightTrackCard({ flightId }: { flightId: string }) {
  const { t, store, access, flights, put, pilot, session } = useApp();
  const flight = flights.find((f) => f.id === flightId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** The actual track from FlightAware (any date), saved with the flight. */
  const fetchTrack = async () => {
    const out = flight?.outUtc ?? flight?.offUtc;
    const inn = flight?.inUtc ?? flight?.onUtc;
    if (!flight?.registration || !out || !inn) return;
    if (!session?.access_token) return setMsg(t("fa.signin"));
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${API_URL}/api/flight-track/flightaware?reg=${encodeURIComponent(flight.registration)}&out=${encodeURIComponent(out)}&in=${encodeURIComponent(inn)}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const d = (await r.json().catch(() => ({}))) as { points?: TrackPoint[]; error?: string };
      if (r.ok && d.points?.length) {
        const rec = await put("flight_tracks", { id: flightId, pilotId: pilot.id, flightId, hex: "", source: "flightaware", points: d.points, fetchedAt: new Date().toISOString() } as never);
        setTrack(rec as unknown as Track);
      } else {
        setMsg(d.error === "not_configured" ? t("fa.off") : d.error === "history_off" ? t("fa.history") : r.status === 429 ? t("fa.limit") : r.status === 404 ? t("fa.trackNone") : t("fa.error"));
      }
    } catch {
      setMsg(t("fa.error"));
    } finally {
      setBusy(false);
    }
  };
  const c = useTheme();
  const [track, setTrack] = useState<Track | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    store.get("flight_tracks", flightId).then((x) => alive && setTrack(x && !x.deletedAt ? x : null));
    return () => {
      alive = false;
    };
  }, [store, flightId]);

  const pts = track?.points ?? [];
  const coords = useMemo(() => pts.map((p) => ({ latitude: p[1], longitude: p[2] })), [pts]);
  const region = useMemo(() => {
    if (coords.length < 2) return undefined;
    const lats = coords.map((p) => p.latitude);
    const lons = coords.map((p) => p.longitude);
    const [a, b, x, y] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
    return { latitude: (a + b) / 2, longitude: (x + y) / 2, latitudeDelta: Math.max(0.2, (b - a) * 1.35), longitudeDelta: Math.max(0.2, (y - x) * 1.35) };
  }, [coords]);

  if (!access.has("tracks") || track === undefined || flight?.isFstd) return null;
  if (!track || coords.length < 2 || !region) {
    // no track yet: fetch it, when the flight has its registration and block times
    if (!flight?.registration || !(flight.outUtc ?? flight.offUtc) || !(flight.inUtc ?? flight.onUtc)) return null;
    return (
      <Card>
        <Txt variant="h2">{t("track.title")}</Txt>
        <Pressable onPress={() => void fetchTrack()} disabled={busy} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.accent }}>
          {busy ? <ActivityIndicator size="small" color={c.accent} /> : <Ionicons name="git-branch-outline" size={15} color={c.accent} />}
          <Txt style={{ fontWeight: "700", fontSize: 13.5 }} color={c.accent}>{t("fa.track")}</Txt>
        </Pressable>
        {msg ? <Txt variant="small" color={c.warning}>{msg}</Txt> : null}
      </Card>
    );
  }
  const maxAlt = Math.max(0, ...pts.map((p) => p[3] ?? 0));
  const maxGs = Math.max(0, ...pts.map((p) => p[4] ?? 0));
  // altitude profile: up to 60 columns
  const step = Math.max(1, Math.floor(pts.length / 60));
  const cols = pts.filter((_, i) => i % step === 0);

  return (
    <Card>
      <Txt variant="h2">{t("track.title")}</Txt>
      <View style={{ height: 220, borderRadius: 14, overflow: "hidden" }}>
        <MapView style={{ flex: 1 }} initialRegion={region} userInterfaceStyle={c.scheme} scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}>
          <Polyline coordinates={coords} strokeColor={c.accent} strokeWidth={3} />
          <Marker coordinate={coords[0]!} pinColor={c.accent} />
          <Marker coordinate={coords[coords.length - 1]!} />
        </MapView>
      </View>
      <Row style={{ alignItems: "flex-end", height: 48, gap: 1 }}>
        {cols.map((p, i) => (
          <View key={i} style={{ flex: 1, height: `${Math.max(2, ((p[3] ?? 0) / Math.max(1000, maxAlt)) * 100)}%`, backgroundColor: c.accent, opacity: 0.55, borderTopLeftRadius: 1, borderTopRightRadius: 1 }} />
        ))}
      </Row>
      <Row gap={16}>
        <Stat label={t("track.window")} value={`${hhmm(pts[0]![0])}–${hhmm(pts[pts.length - 1]![0])}`} />
        <Stat label={t("track.maxAlt")} value={`${(Math.round(maxAlt / 100) * 100).toLocaleString()} ft`} />
        <Stat label={t("track.maxGs")} value={`${maxGs} kt`} />
      </Row>
      <FlightContextView flightId={flightId} points={pts} />
      {track.source === "flightaware" ? (
        <Pressable onPress={() => void Linking.openURL("https://www.flightaware.com")}>
          <Txt variant="small">{t("fa.trackFrom")}</Txt>
        </Pressable>
      ) : (
        <Pressable onPress={() => void Linking.openURL("https://www.adsb.lol")}>
          <Txt variant="small">{t("track.source", { hex: track.hex.toUpperCase() })}</Txt>
        </Pressable>
      )}
    </Card>
  );
}

interface Ctx {
  airspaces: CrossedAirspace[];
  cruise: { altFt: number; windFrom?: number; windKt?: number; tempC?: number; head?: number; cross?: number } | null;
  missing: string[];
}
const ctxCache = new Map<string, Ctx>();
const TONE: Record<string, string> = { CTR: "#a5b4fc", ATZ: "#a5b4fc", TMA: "#7dd3fc", CTA: "#7dd3fc", R: "#fca5a5", P: "#fca5a5", D: "#fcd34d", TRA: "#fcd34d", TSA: "#fcd34d" };

/** The airspaces a logged flight crossed and the wind at cruise, from its track (server: openAIP, Open-Meteo). */
function FlightContextView({ flightId, points }: { flightId: string; points: TrackPoint[] }) {
  const { t, session } = useApp();
  const c = useTheme();
  const [data, setData] = useState<Ctx | null>(ctxCache.get(flightId) ?? null);
  useEffect(() => {
    if (data || !session?.access_token || points.length < 2) return;
    let alive = true;
    fetch(`${API_URL}/api/flight-context`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ points }) })
      .then((r) => (r.ok ? (r.json() as Promise<Ctx>) : null))
      .then((d) => {
        if (!d || !alive) return;
        if (!d.missing.some((m) => m.endsWith("Error"))) ctxCache.set(flightId, d);
        setData(d);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [data, session?.access_token, points, flightId]);
  if (!data) return null;
  const main = data.airspaces.filter((a) => a.type !== "FIR" && a.type !== "UIR");
  const firs = data.airspaces.filter((a) => a.type === "FIR" || a.type === "UIR");
  const cr = data.cruise;
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(10,22,38,0.1)", paddingTop: 10 }}>
      <Txt variant="label">{t("ctx.airspaces")}</Txt>
      {data.missing.includes("airspace") ? (
        <Txt variant="small">{t("ctx.airspaceSoon")}</Txt>
      ) : main.length + firs.length === 0 ? (
        <Txt variant="small">{data.missing.includes("airspaceError") ? t("ctx.error") : t("ctx.none")}</Txt>
      ) : (
        <>
          <Row style={{ flexWrap: "wrap" }} gap={6}>
            {main.map((a) => (
              <View key={a.id} style={{ borderWidth: 1, borderColor: (TONE[a.type] ?? c.muted) + "88", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Txt style={{ fontSize: 12, fontWeight: "700" }} color={TONE[a.type] ?? c.text}>{`${a.name}${a.icaoClass ? ` · ${a.icaoClass}` : ""}`}</Txt>
              </View>
            ))}
          </Row>
          {firs.length ? <Txt variant="small">{`${t("ctx.firs")} ${firs.map((f) => f.name).join(" → ")}`}</Txt> : null}
        </>
      )}
      {cr ? (
        <>
          <Txt variant="label">{t("ctx.cruise", { fl: `FL${String(Math.round(cr.altFt / 100)).padStart(3, "0")}` })}</Txt>
          {cr.windKt == null ? (
            <Txt variant="small">{data.missing.includes("windError") ? t("ctx.error") : t("ctx.windSoon")}</Txt>
          ) : (
            <Row gap={16} style={{ flexWrap: "wrap" }}>
              <Stat label={t("ctx.wind")} value={`${String(cr.windFrom).padStart(3, "0")}°/${cr.windKt} kt`} />
              <Stat label={cr.head! >= 0 ? t("ctx.headwind") : t("ctx.tailwind")} value={`${Math.abs(cr.head!)} kt`} />
              <Stat label={t("ctx.crosswind")} value={`${Math.abs(cr.cross!)} kt`} />
              <Stat label={t("ctx.oat")} value={`${cr.tempC} °C`} />
            </Row>
          )}
        </>
      ) : null}
      <Txt variant="small" style={{ fontSize: 10.5 }}>{t("ctx.disclaimer")}</Txt>
    </View>
  );
}
