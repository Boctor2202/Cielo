import React, { useMemo } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDuration, type Flight, type GoalProgress, type Totals } from "@cielo/core";
import { Roll } from "./Roll";
import { Track } from "./Bars";
import { Row, Txt, tap } from "./ui";
import { useTheme } from "../theme";

const GREEN = "#22C55E";
const INDIGO = "#818CF8";
const SKY = "#38BDF8";
const AMBER = "#FBBF24";

/** A ring filled to `ratio`, the value in the middle. */
function Ring({ ratio, size = 92, label, sub }: { ratio: number; size?: number; label: string; sub?: string }) {
  const c = useTheme();
  const r = (size - 10) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.10)"} strokeWidth={7} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={GREEN} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={`${len * Math.min(1, ratio)} ${len}`} />
      </Svg>
      <Txt mono style={{ fontSize: 18, fontWeight: "700" }}>{label}</Txt>
      {sub ? <Txt variant="small" style={{ fontSize: 10.5 }}>{sub}</Txt> : null}
    </View>
  );
}

/** Hours of each of the last 12 months as bars, the night hours at the foot of each bar. */
function MonthBars({ months, width, height = 70 }: { months: { label: string; total: number; night: number }[]; width: number; height?: number }) {
  const c = useTheme();
  const max = Math.max(1, ...months.map((m) => m.total));
  const slot = width / Math.max(1, months.length);
  const w = Math.min(18, slot * 0.62);
  // room above the bars for their value
  const h = (v: number) => (v / max) * (height - 16);
  return (
    <View style={{ gap: 4 }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={GREEN} stopOpacity={1} />
            <Stop offset="1" stopColor={GREEN} stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        {months.map((m, i) => {
          const x = i * slot + (slot - w) / 2;
          return (
            <React.Fragment key={i}>
              {m.total > 0 ? <Rect x={x} y={height - h(m.total)} width={w} height={h(m.total)} rx={3} fill="url(#bar)" /> : <Rect x={x} y={height - 2} width={w} height={2} rx={1} fill={c.muted} opacity={0.3} />}
              {m.night > 0 ? <Rect x={x} y={height - h(m.night)} width={w} height={h(m.night)} rx={2} fill={INDIGO} /> : null}
              {m.total > 0 ? (
                <SvgText x={i * slot + slot / 2} y={height - h(m.total) - 4} fontSize={9} fontWeight="700" fill={c.text} textAnchor="middle">
                  {String(Math.round(m.total))}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", width }}>
        {months.map((m, i) => (
          <Txt key={i} variant="small" style={{ width: slot, textAlign: "center", fontSize: 10 }}>{m.label}</Txt>
        ))}
      </View>
    </View>
  );
}

/** A coloured chip: icon, label, value, and the share of the total as a thin bar. */
function Chip3({ icon, color, label, value, share }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string; share: number }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, gap: 4, padding: 10, borderRadius: 14, backgroundColor: color + "1A" }}>
      <Row gap={5} style={{ alignItems: "center" }}>
        <Ionicons name={icon} size={13} color={color} />
        <Txt variant="small" style={{ fontSize: 12 }} color={color}>{label}</Txt>
      </Row>
      <Txt mono style={{ fontSize: 18, fontWeight: "700" }}>{value}</Txt>
      <Track ratio={share} color={color} height={5} />
    </View>
  );
}

/** The headline: total time rolling in, the next milestone as a ring, PIC / night / IFR, and the last 12 months. */
export function HeroCard({ all, flights, goal, timeDisplay, t, monthLabel, locale }: { all: Totals; flights: Flight[]; goal?: GoalProgress; timeDisplay: "hhmm" | "decimal"; t: (k: never, v?: Record<string, string | number>) => string; monthLabel: string; locale: string }) {
  const c = useTheme();
  const fmt = (m: number) => formatDuration(m, timeDisplay);
  const months = useMemo(() => {
    const now = new Date();
    const keys = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
      return d.toISOString().slice(0, 7);
    });
    const m = new Map(keys.map((k) => [k, { total: 0, night: 0 }]));
    for (const f of flights) {
      const e = m.get(f.date.slice(0, 7));
      if (!e || f.deletedAt || f.isFstd) continue;
      e.total += f.totalMin;
      e.night += f.nightMin;
    }
    const fmtM = new Intl.DateTimeFormat(locale, { month: "narrow", timeZone: "UTC" });
    return keys.map((k) => ({ label: fmtM.format(new Date(`${k}-15T12:00:00Z`)), total: m.get(k)!.total / 60, night: m.get(k)!.night / 60 }));
  }, [flights, locale]);
  const [w, setW] = React.useState(0);
  const total = Math.max(1, all.totalMin);
  return (
    <View style={{ borderRadius: 22, overflow: "hidden" }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {/* a deep night-blue gradient with a green glow, behind the glass */}
      <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
        <Defs>
          <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.scheme === "dark" ? "#13294A" : "#FFFFFF"} stopOpacity={c.scheme === "dark" ? 0.92 : 0.8} />
            <Stop offset="1" stopColor={c.scheme === "dark" ? "#0A1626" : "#E7F5EC"} stopOpacity={c.scheme === "dark" ? 0.86 : 0.8} />
          </LinearGradient>
          <LinearGradient id="glow" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={GREEN} stopOpacity={0.22} />
            <Stop offset="0.6" stopColor={GREEN} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>
      <View style={{ padding: 18, gap: 14, borderRadius: 22, borderWidth: 1, borderColor: GREEN + "33" }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Txt variant="label">{t("dash.totalHours" as never)}</Txt>
            <Roll text={fmt(all.totalMin)} size={48} style={{ fontWeight: "300", letterSpacing: -1.2 }} />
            <Txt variant="small">
              {t("dash.flights" as never, { n: all.flights })} · {t("dash.landings" as never)} {all.landingsDay + all.landingsNight}
            </Txt>
          </View>
          {goal ? (
            <Ring ratio={goal.ratio} label={`${Math.round(goal.ratio * 100)}%`} sub={`→ ${Math.round(goal.goal.target / 60).toLocaleString()} h`} />
          ) : null}
        </Row>
        <Row gap={8}>
          <Chip3 icon="ribbon" color={GREEN} label="PIC" value={fmt(all.picMin + all.picusMin)} share={(all.picMin + all.picusMin) / total} />
          <Chip3 icon="moon" color={INDIGO} label={t("dash.night" as never)} value={fmt(all.nightMin)} share={all.nightMin / total} />
          <Chip3 icon="cloud" color={SKY} label="IFR" value={fmt(all.ifrMin)} share={all.ifrMin / total} />
        </Row>
        {w > 0 ? (
          <View style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt variant="small">{monthLabel}</Txt>
              <Txt mono variant="small" color={GREEN}>{`${Math.round(months.reduce((s, x) => s + x.total, 0))} h`}</Txt>
            </Row>
            <MonthBars months={months} width={w - 36} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The next duty: route with a dashed track and an aircraft, countdown, departure and report times. */
export function DutyCard({ title, from, to, label, countdown, chips, onPress }: { title: string; from?: string; to?: string; label?: string; countdown: string; chips: string[]; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={() => (tap(), onPress())} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ borderRadius: 22, padding: 18, gap: 12, backgroundColor: c.scheme === "dark" ? "rgba(56,189,248,0.10)" : "rgba(56,189,248,0.12)", borderWidth: 1, borderColor: SKY + "40" }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Row gap={6} style={{ alignItems: "center" }}>
            <Ionicons name="calendar" size={14} color={SKY} />
            <Txt variant="label" color={SKY}>{title}</Txt>
          </Row>
          <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: GREEN + "26" }}>
            <Txt mono style={{ fontWeight: "700", fontSize: 13 }} color={GREEN}>{countdown}</Txt>
          </View>
        </Row>
        {from && to ? (
          <Row style={{ alignItems: "center" }} gap={10}>
            <Txt mono style={{ fontSize: 26, fontWeight: "800", letterSpacing: 0.5 }}>{from}</Txt>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 24 }}>
              <View style={{ position: "absolute", left: 0, right: 0, top: 11, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: c.muted }} />
              <View style={{ backgroundColor: c.scheme === "dark" ? "#0F2238" : "#EAF6FD", paddingHorizontal: 6 }}>
                <Ionicons name="airplane" size={18} color={SKY} />
              </View>
            </View>
            <Txt mono style={{ fontSize: 26, fontWeight: "800", letterSpacing: 0.5 }}>{to}</Txt>
          </Row>
        ) : (
          <Txt style={{ fontSize: 22, fontWeight: "700" }}>{label}</Txt>
        )}
        <Row gap={6} style={{ flexWrap: "wrap" }}>
          {chips.map((x) => (
            <View key={x} style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(10,22,38,0.06)" }}>
              <Txt mono variant="small" style={{ fontSize: 12 }}>{x}</Txt>
            </View>
          ))}
        </Row>
      </View>
    </Pressable>
  );
}

/** The last flight: coloured edge, route, function badge, aircraft chip and block time. */
export function LastFlightCard({ title, f, time, date, onPress }: { title: string; f: Flight; time: string; date: string; onPress: () => void }) {
  const c = useTheme();
  const tone: Record<string, string> = { PIC: "#34D399", SIC: SKY, PICUS: "#2DD4BF", DUAL: AMBER, FI: "#A78BFA", FE: "#E879F9" };
  const edge = f.nightMin > 0 ? INDIGO : f.ifrMin > 0 ? SKY : GREEN;
  return (
    <Pressable onPress={() => (tap(), onPress())} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ flexDirection: "row", borderRadius: 22, overflow: "hidden", backgroundColor: c.scheme === "dark" ? "rgba(17,34,58,0.72)" : "rgba(243,246,249,0.72)", borderWidth: 1, borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)" }}>
        <View style={{ width: 4, backgroundColor: edge }} />
        <View style={{ flex: 1, padding: 16, gap: 8 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Txt variant="label">{title}</Txt>
            <Txt variant="small">{date}</Txt>
          </Row>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Row gap={8} style={{ alignItems: "center" }}>
              <Txt mono style={{ fontSize: 22, fontWeight: "800" }}>{f.depIcao}</Txt>
              <Ionicons name="airplane" size={15} color={GREEN} />
              <Txt mono style={{ fontSize: 22, fontWeight: "800" }}>{f.arrIcao}</Txt>
            </Row>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: GREEN + "26" }}>
              <Txt mono style={{ fontWeight: "800", fontSize: 16 }} color={GREEN}>{time}</Txt>
            </View>
          </Row>
          <Row gap={6} style={{ alignItems: "center", flexWrap: "wrap" }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: (tone[f.function] ?? "#94A3B8") + "26" }}>
              <Txt mono style={{ fontSize: 12, fontWeight: "700" }} color={tone[f.function] ?? c.muted}>{f.function}</Txt>
            </View>
            {f.registration ? (
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1, borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,22,38,0.12)" }}>
                <Txt mono style={{ fontSize: 12, fontWeight: "600" }}>{f.registration}</Txt>
              </View>
            ) : null}
            {f.aircraftTypeIcao ? <Txt mono variant="small">{f.aircraftTypeIcao}</Txt> : null}
            {f.nightMin > 0 ? <Txt mono variant="small" color={INDIGO}>☾ {formatDuration(f.nightMin)}</Txt> : null}
          </Row>
        </View>
      </View>
    </Pressable>
  );
}

/** 28 days / 90 days / 12 months as three tiles with a coloured top edge. */
export function PeriodTiles({ items }: { items: { label: string; value: string; sub: string; color: string }[] }) {
  const c = useTheme();
  return (
    <Row gap={8}>
      {items.map((x) => (
        <View key={x.label} style={{ flex: 1, borderRadius: 18, overflow: "hidden", backgroundColor: c.scheme === "dark" ? "rgba(17,34,58,0.72)" : "rgba(243,246,249,0.72)", borderWidth: 1, borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)" }}>
          <View style={{ height: 3, backgroundColor: x.color }} />
          <View style={{ padding: 12, gap: 2 }}>
            <Txt variant="small" color={x.color} style={{ fontWeight: "600" }}>{x.label}</Txt>
            <Roll text={x.value} size={20} style={{ fontWeight: "700" }} />
            <Txt variant="small" style={{ fontSize: 11.5 }}>{x.sub}</Txt>
          </View>
        </View>
      ))}
    </Row>
  );
}
