import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ageMin, ceilingFt, tafLines, visibilityText, windText, type FlightCategory, type Metar, type Taf } from "@cielo/core";
import { api } from "../api";
import { useApp } from "../state";
import { mono, useTheme } from "../theme";
import { Row, Txt } from "./ui";

/** Flight category colours, the convention of aviation weather maps. */
const CATEGORY_COLOR: Record<FlightCategory, string> = { VFR: "#16a34a", MVFR: "#2563eb", IFR: "#dc2626", LIFR: "#c026d3" };

type Wx = { metars: Record<string, Metar>; tafs: Record<string, Taf> };
const cache = new Map<string, { at: number; p: Promise<Wx | null> }>();
function fetchWeather(icao: string) {
  const hit = cache.get(icao);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.p;
  const p = api<Wx>(`/api/weather?ids=${icao}`).catch(() => null);
  cache.set(icao, { at: Date.now(), p });
  return p;
}

/** Decoded METAR, raw METAR and TAF for one aerodrome (Aviation Weather Center, NOAA). */
export function AirportWeather({ icao, compact }: { icao: string; compact?: boolean }) {
  const { t } = useApp();
  const c = useTheme();
  const [wx, setWx] = useState<{ metar?: Metar; taf?: Taf } | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setWx(undefined);
    fetchWeather(icao).then((d) => alive && setWx(d ? { metar: d.metars[icao], taf: d.tafs[icao] } : null));
    return () => {
      alive = false;
    };
  }, [icao]);

  if (wx === undefined) return <ActivityIndicator color={c.accent} />;
  if (!wx || (!wx.metar && !wx.taf)) return <Txt variant="muted">{t("wx.none", { icao })}</Txt>;
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
          <View style={box}>
            <Txt variant="label">METAR{age != null ? ` · ${t("wx.ago", { min: age })}` : ""}</Txt>
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
