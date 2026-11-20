import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { clockIn, formatOffset, nightPath, timezoneMap, zoneOffsetMin, type TimezoneMapData } from "@cielo/core";
import { Card, Row, Screen, Txt } from "../../src/components/ui";
import { lookupAirport } from "../../src/airports";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MAP = timezoneMap(require("@cielo/reference-data/timezones.json") as TimezoneMapData);
const ASPECT = 2048 / 819;
const OFFSETS = Array.from({ length: 24 }, (_, i) => i - 11);

/** The world's time zones: the map by UTC offset, the night side right now, and the pilot's airports with their local time. */
export default function Timezones() {
  const { t, flights, pilot } = useApp();
  const c = useTheme();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const [picked, setPicked] = useState<{ x: number; y: number; zone: string } | null>(null);
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
  const mapW = width - 32;
  const mapH = mapW / ASPECT;
  const H = MAP.span;
  const far = (i: number) => {
    const p = MAP.xy(places[i]!.lat, places[i]!.lon);
    return places.slice(0, i).every((b) => Math.hypot(MAP.xy(b.lat, b.lon).x - p.x, MAP.xy(b.lat, b.lon).y - p.y) > 14);
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

      <Pressable
        style={{ width: mapW, height: mapH, borderRadius: 16, overflow: "hidden" }}
        onPress={(e) => {
          const x = (e.nativeEvent.locationX / mapW) * 360;
          const y = (e.nativeEvent.locationY / mapH) * H;
          const zone = MAP.zoneAt(MAP.north - y, x - 180);
          setPicked(zone ? { x, y, zone } : null);
        }}
      >
        <Image source={require("../../assets/timezones.png")} style={{ width: mapW, height: mapH }} contentFit="fill" />
        <Svg width={mapW} height={mapH} viewBox={`0 0 360 ${H}`} preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 0 }}>
          <Path d={MAP.land} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.3} />
          <Path d={nightPath(now, MAP.north, MAP.south)} fill="rgba(2,6,23,0.42)" />
          {OFFSETS.filter((o) => o % 3 === 0).map((o) => (
            <SvgText key={o} x={o * 15 + 180} y={9} textAnchor="middle" fontSize={7} fontWeight="700" fill="#fff" opacity={0.85}>
              {clockIn(`Etc/GMT${o > 0 ? "-" : "+"}${Math.abs(o)}`, now)}
            </SvgText>
          ))}
          {places.map((a, i) => {
            const p = MAP.xy(a.lat, a.lon);
            return (
              <G key={a.icao}>
                <Circle cx={p.x} cy={p.y} r={i === 0 ? 2.6 : 1.8} fill={i === 0 ? "#22c55e" : "#fff"} stroke="#020617" strokeWidth={0.6} />
                {i === 0 || far(i) ? (
                  <SvgText x={p.x + 3.5} y={p.y + 2} fontSize={6} fontWeight="700" fill="#fff" stroke="#020617" strokeWidth={0.8}>
                    {a.icao}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          {picked ? <Circle cx={picked.x} cy={picked.y} r={2.4} fill="#fbbf24" stroke="#020617" strokeWidth={0.6} /> : null}
        </Svg>
      </Pressable>

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
