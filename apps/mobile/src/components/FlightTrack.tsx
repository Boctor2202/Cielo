import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { API_URL } from "../api";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { FlightTrack as Track, TrackPoint } from "@cielo/core";
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
