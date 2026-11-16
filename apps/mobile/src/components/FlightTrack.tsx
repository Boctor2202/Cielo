import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { FlightTrack as Track } from "@cielo/core";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Card, Row, Stat, Txt } from "./ui";

const hhmm = (s: number) => new Date(s * 1000).toISOString().slice(11, 16);

/** The real ADS-B track saved with a logged flight (fetched by the web app while adsb.lol still had it). */
export function FlightTrackCard({ flightId }: { flightId: string }) {
  const { t, store, access } = useApp();
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

  if (!access.has("tracks") || !track || coords.length < 2 || !region) return null;
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
      <Pressable onPress={() => void Linking.openURL("https://www.adsb.lol")}>
        <Txt variant="small">{t("track.source", { hex: track.hex.toUpperCase() })}</Txt>
      </Pressable>
    </Card>
  );
}
