import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ageMin, ceilingFt, tafLines, visibilityText, windText, type FlightCategory, type Metar, type RunwayEstimate, type Taf } from "@cielo/core";
import { api } from "../api";
import { useApp } from "../state";
import { mono, useTheme } from "../theme";
import { Row, Txt } from "./ui";

/** Flight category colours, the convention of aviation weather maps. */
const CATEGORY_COLOR: Record<FlightCategory, string> = { VFR: "#16a34a", MVFR: "#2563eb", IFR: "#dc2626", LIFR: "#c026d3" };

type Wx = { metars: Record<string, Metar>; tafs: Record<string, Taf>; runways?: Record<string, RunwayEstimate> };
const cache = new Map<string, { at: number; p: Promise<Wx | null> }>();
/** METARs of several aerodromes (no TAF), for the runway shown next to each code on the radar. */
export function fetchRunways(ids: string[]): Promise<Record<string, RunwayEstimate>> {
  const key = [...ids].sort().join(",");
  return api<Wx>(`/api/weather?ids=${key}&taf=0`)
    .then((d) => d.runways ?? {})
    .catch(() => ({}));
}

function fetchWeather(icao: string, fresh = false) {
  const hit = cache.get(icao);
  if (!fresh && hit && Date.now() - hit.at < 5 * 60_000) return hit.p;
  const p = api<Wx>(`/api/weather?ids=${icao}${fresh ? `&fresh=1&t=${Date.now()}` : ""}`).catch(() => null);
  cache.set(icao, { at: Date.now(), p });
  return p;
}

/** Decoded METAR, raw METAR and TAF for one aerodrome (Aviation Weather Center, NOAA). */
export function AirportWeather({ icao, compact }: { icao: string; compact?: boolean }) {
  const { t } = useApp();
  const c = useTheme();
  const [wx, setWx] = useState<{ metar?: Metar; taf?: Taf; runway?: RunwayEstimate } | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let alive = true;
    if (tick) setRefreshing(true);
    else setWx(undefined);
    fetchWeather(icao, tick > 0).then((d) => {
      if (!alive) return;
      setWx(d ? { metar: d.metars[icao], taf: d.tafs[icao], runway: d.runways?.[icao] } : null);
      setRefreshing(false);
    });
    return () => {
      alive = false;
    };
  }, [icao, tick]);
  const refresh = (
    <Pressable onPress={() => setTick((x) => x + 1)} disabled={refreshing} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {refreshing ? <ActivityIndicator size="small" color={c.muted} /> : <Ionicons name="refresh" size={15} color={c.muted} />}
      <Txt variant="small" color={c.muted}>{t("wx.refresh")}</Txt>
    </Pressable>
  );

  if (wx === undefined) return <ActivityIndicator color={c.accent} />;
  if (!wx || (!wx.metar && !wx.taf))
    return (
      <Row style={{ justifyContent: "space-between" }}>
        <Txt variant="muted">{t("wx.none", { icao })}</Txt>
        {refresh}
      </Row>
    );
  const m = wx.metar;
  const age = ageMin(m?.obsTime);
  const ceil = m ? ceilingFt(m.clouds) : null;
  const box = { backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(10,22,38,0.05)", borderRadius: 10, padding: 10, gap: 2 };
  const kv = (k: string, v: string) => (
    <Txt variant="small">
      {k} <Txt variant="small" mono style={{ fontWeight: "700" }} color={c.text}>{v}</Txt>
    </Txt>
  );
  return (
    <View style={{ gap: 10 }}>
      {m ? (
        <>
          <Row style={{ flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
            {m.category ? (
              <View style={{ backgroundColor: CATEGORY_COLOR[m.category], borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Txt style={{ fontSize: 12, fontWeight: "800" }} color="#fff">{m.category}</Txt>
              </View>
            ) : null}
            {kv(t("wx.wind"), windText(m, t("wx.calm")))}
            {kv(t("wx.visibility"), visibilityText(m.visibSm))}
            {kv(t("wx.ceiling"), ceil != null ? `${ceil} ft` : t("wx.noCeiling"))}
            {m.tempC != null ? kv(t("wx.temp"), `${m.tempC}°/${m.dewpC ?? "—"}°`) : null}
            {m.qnhHpa != null ? kv("QNH", String(Math.round(m.qnhHpa))) : null}
          </Row>
          {wx.runway ? (
            <View style={{ gap: 2 }}>
              <Row style={{ flexWrap: "wrap", columnGap: 8 }}>
                <Txt variant="small">{t("wx.runway")}</Txt>
                {wx.runway.calm ? (
                  <Txt variant="small" style={{ fontWeight: "700" }} color={c.text}>{t("wx.runwayCalm")}</Txt>
                ) : (
                  <>
                    <Txt mono style={{ fontWeight: "800", fontSize: 16 }}>{wx.runway.ident}</Txt>
                    <Txt variant="small" mono>{t("wx.components", { head: wx.runway.headwindKt, cross: wx.runway.crosswindKt })}</Txt>
                  </>
                )}
              </Row>
              <Txt variant="small">{t("wx.runwayNote")}</Txt>
            </View>
          ) : null}
          <View style={box}>
            <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="label">METAR{age != null ? ` · ${t("wx.ago", { min: age })}` : ""}</Txt>
              {refresh}
            </Row>
            <Txt style={[mono, { fontSize: 13 }]} color={age != null && age > 90 ? c.warning : c.text}>{m.raw}</Txt>
          </View>
        </>
      ) : null}
      {wx.taf ? (
        <View style={box}>
          <Txt variant="label">TAF</Txt>
          {tafLines(wx.taf.raw).map((l, i) => (
            <Txt key={i} style={[mono, { fontSize: 13, paddingLeft: i ? 12 : 0 }]}>{l}</Txt>
          ))}
        </View>
      ) : null}
      {!compact ? <Txt variant="small">{t("wx.source")}</Txt> : null}
    </View>
  );
}
