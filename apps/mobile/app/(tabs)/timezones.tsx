import React, { useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { clockIn, formatOffset, nightRing, timezoneMap, zoneOffsetMin, type TimezoneMapData } from "@cielo/core";
import { Card, Row, Screen, Txt } from "../../src/components/ui";
import { lookupAirport } from "../../src/airports";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MAP = timezoneMap(require("@cielo/reference-data/timezones.json") as TimezoneMapData);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ZONES = require("@cielo/reference-data/timezones-polygons.json") as { features: { properties: { offset: number }; geometry: { coordinates: number[][][][] } }[] };
type LatLng = { latitude: number; longitude: number };
const ll = (ring: number[][]): LatLng[] => ring.map(([lon, lat]) => ({ latitude: lat!, longitude: lon! }));
/** one polygon per piece of each offset zone, with its holes, and its colour */
const POLYGONS = ZONES.features.flatMap((f, fi) =>
  f.geometry.coordinates.map((poly, pi) => {
    const h = f.properties.offset / 60;
    const hue = (((h + 12) / 26) * 300 + 190) % 360;
    const even = Math.round(h) % 2 === 0;
    return { key: `${fi}-${pi}`, outer: ll(poly[0]!), holes: poly.slice(1).map(ll), fill: `hsla(${hue.toFixed(0)}, 55%, ${even ? 55 : 45}%, 0.32)` };
  }),
);

/** The world's time zones: the map by UTC offset, the night side right now, and the pilot's airports with their local time. */
export default function Timezones() {
  const { t, flights, pilot } = useApp();
  const c = useTheme();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const [picked, setPicked] = useState<{ lat: number; lon: number; zone: string } | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const places = useMemo(() => {
    const codes: string[] = [];
    if (pilot.homeBaseIcao) codes.push(pilot.homeBaseIcao);
    const recent = flights.filter((f) => !f.deletedAt).sort((a, b) => (b.outUtc ?? b.date).localeCompare(a.outUtc ?? a.date));
    for (const f of recent) {
      for (const code of [f.arrIcao, f.depIcao]) if (code && !codes.includes(code)) codes.push(code);
      if (codes.length >= 8) break;
    }
    return codes.map((code) => lookupAirport(code)).filter((a): a is NonNullable<typeof a> => !!a && !!a.timezone);
  }, [flights, pilot.homeBaseIcao]);

  let local: string | undefined;
  try {
    local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    local = undefined;
  }
  const slot = Math.floor(now.getTime() / 300_000);
  const night = useMemo(() => ll(nightRing(new Date(slot * 300_000))), [slot]);
  const pick = (lat: number, lon: number) => {
    const zone = MAP.zoneAt(lat, lon);
    setPicked(zone ? { lat, lon, zone } : null);
  };


  return (
    <Screen>
      <Txt variant="muted">{t("tz.subtitle")}</Txt>
      <Row style={{ gap: 8 }}>
        {[
          { k: "UTC", v: clockIn("UTC", now), s: "" },
          { k: t("dash.localTime"), v: clockIn(undefined, now), s: local ? `${local.split("/").pop()?.replace(/_/g, " ")} · ${formatOffset(zoneOffsetMin(local, now))}` : "" },
        ].map((x) => (
          <View key={x.k} style={{ flex: 1, flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", backgroundColor: "rgba(15,23,42,0.55)" }}>
            <Txt variant="small" style={{ fontWeight: "700", fontSize: 10.5 }}>{x.k}</Txt>
            <Txt mono style={{ fontSize: 20, fontWeight: "700" }}>{x.v}</Txt>
            {x.s ? <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{x.s}</Txt> : null}
          </View>
        ))}
      </Row>

      <View style={{ height: Math.round(width * 0.95), borderRadius: 16, overflow: "hidden" }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: 35, longitude: 10, latitudeDelta: 120, longitudeDelta: 160 }}
          userInterfaceStyle={c.scheme}
          rotateEnabled={false}
          pitchEnabled={false}
          onPress={(e) => pick(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
        >
          {POLYGONS.map((p) => (
            <Polygon key={p.key} coordinates={p.outer} holes={p.holes} fillColor={p.fill} strokeColor="rgba(203,213,225,0.55)" strokeWidth={0.6} tappable={false} />
          ))}
          <Polygon coordinates={night} fillColor="rgba(2,6,23,0.35)" strokeWidth={0} tappable={false} />
          {places.map((a, i) => (
            <Marker
              key={a.icao}
              coordinate={{ latitude: a.lat, longitude: a.lon }}
              pinColor={i === 0 ? "#22c55e" : undefined}
              title={`${a.icao} · ${clockIn(a.timezone, now)}`}
              description={formatOffset(zoneOffsetMin(a.timezone!, now))}
            />
          ))}
          {picked ? <Marker coordinate={{ latitude: picked.lat, longitude: picked.lon }} pinColor="#fbbf24" /> : null}
        </MapView>
      </View>

      {picked ? (
        <Card>
          <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <Txt style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>{picked.zone.replace(/_/g, " ")}</Txt>
            <Txt mono style={{ fontSize: 22, fontWeight: "800" }} color="#fbbf24">{clockIn(picked.zone, now)}</Txt>
          </Row>
          <Txt variant="small">{formatOffset(zoneOffsetMin(picked.zone, now))}</Txt>
        </Card>
      ) : (
        <Txt variant="small">{t("tz.legend")}</Txt>
      )}

      {places.length ? (
        <Card>
          <Txt variant="h2">{t("tz.airports")}</Txt>
          {places.map((a, i) => (
            <Row key={a.icao} style={{ justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Txt mono style={{ fontWeight: "700" }}>
                  {a.icao}
                  {i === 0 && pilot.homeBaseIcao === a.icao ? <Txt variant="small" color={c.accent}>{`  ${t("tz.base")}`}</Txt> : null}
                </Txt>
                <Txt variant="small" numberOfLines={1}>{a.city || a.name}</Txt>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Txt mono style={{ fontSize: 20, fontWeight: "700" }}>{clockIn(a.timezone, now)}</Txt>
                <Txt variant="small">{formatOffset(zoneOffsetMin(a.timezone!, now))}</Txt>
              </View>
            </Row>
          ))}
        </Card>
      ) : null}
      <Txt variant="small" style={{ fontSize: 10 }}>{MAP.attribution}</Txt>
    </Screen>
  );
}
