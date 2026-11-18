import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { formatClock, formatDuration, sumFlights, type Flight } from "@cielo/core";
import { Card, Row, Txt, tap } from "./ui";
import { formatMonth } from "../i18n";
import { todayUtc, useApp } from "../state";
import { glass, space, useTheme } from "../theme";

const pad = (n: number) => String(n).padStart(2, "0");
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

/**
 * The logbook as a month calendar: flown days tinted by their block time, rostered duties marked, the month's
 * totals on top; a tap on a day lists its flights.
 */
export function LogbookCalendar({ flights }: { flights: Flight[] }) {
  const { t, locale, pilot, rosterEvents } = useApp();
  const c = useTheme();
  const today = todayUtc();
  const latest = flights[0]?.date.slice(0, 7) ?? today.slice(0, 7);
  const [month, setMonth] = useState(latest > today.slice(0, 7) ? today.slice(0, 7) : latest);
  const [day, setDay] = useState<string | null>(null);
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);

  const byDay = useMemo(() => {
    const m = new Map<string, Flight[]>();
    for (const f of flights) if (f.date.startsWith(month)) m.set(f.date, [...(m.get(f.date) ?? []), f]);
    return m;
  }, [flights, month]);
  const duties = useMemo(() => new Set(rosterEvents.filter((e) => !e.deletedAt && e.kind !== "OFF" && e.startUtc.startsWith(month)).map((e) => e.startUtc.slice(0, 10))), [rosterEvents, month]);
  const totals = useMemo(() => sumFlights([...byDay.values()].flat()), [byDay]);
  const maxMin = Math.max(60, ...[...byDay.values()].map((fs) => fs.reduce((s, f) => s + (f.isFstd ? f.fstdMin : f.totalMin), 0)));

  // Monday-first grid
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 5 + i)).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "narrow", timeZone: "UTC" }),
  );
  const flownDays = byDay.size;
  const selected = day ? byDay.get(day) ?? [] : [];

  return (
    <View style={{ gap: space.md, marginHorizontal: space.md, marginTop: space.sm }}>
      <Card>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Pressable hitSlop={12} onPress={() => (tap(), setMonth(addMonths(month, -1)), setDay(null))} accessibilityLabel={t("cal.prev")}>
            <Ionicons name="chevron-back" size={22} color={c.accent} />
          </Pressable>
          <Txt variant="h2" style={{ textTransform: "capitalize" }}>{formatMonth(month, locale)}</Txt>
          <Pressable hitSlop={12} onPress={() => (tap(), setMonth(addMonths(month, 1)), setDay(null))} accessibilityLabel={t("cal.next")}>
            <Ionicons name="chevron-forward" size={22} color={c.accent} />
          </Pressable>
        </Row>
        <Txt variant="small" mono style={{ textAlign: "center" }}>
          {t("cal.summary", { time: fmt(totals.totalMin), n: totals.flights + totals.fstdSessions, days: flownDays })}
        </Txt>
        <View style={{ flexDirection: "row" }}>
          {weekdays.map((w, i) => (
            <Txt key={i} variant="small" style={{ flex: 1, textAlign: "center", textTransform: "uppercase" }}>{w}</Txt>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const fs = byDay.get(d) ?? [];
            const min = fs.reduce((s, f) => s + (f.isFstd ? f.fstdMin : f.totalMin), 0);
            const k = fs.length ? 0.25 + 0.6 * (min / maxMin) : 0;
            const isToday = d === today;
            const on = d === day;
            return (
              <Pressable
                key={d}
                onPress={() => (tap(), setDay(on ? null : d))}
                style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                accessibilityLabel={`${d}${fs.length ? ` · ${fmt(min)}` : ""}`}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: fs.length ? `rgba(34,197,94,${k.toFixed(2)})` : glass(c).input,
                    borderWidth: on || isToday ? 1.5 : 0,
                    borderColor: on ? c.text : c.accent,
                  }}
                >
                  <Txt style={{ fontSize: 14, fontWeight: fs.length ? "700" : "400" }} color={fs.length ? c.text : c.muted}>{Number(d.slice(8))}</Txt>
                  {fs.length ? (
                    <Txt mono style={{ fontSize: 9.5 }} color={c.text}>{fmt(min)}</Txt>
                  ) : duties.has(d) ? (
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.caution, marginTop: 2 }} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Row gap={space.md} style={{ justifyContent: "center" }}>
          <Row gap={4} style={{ alignItems: "center" }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "rgba(34,197,94,0.7)" }} />
            <Txt variant="small">{t("cal.flown")}</Txt>
          </Row>
          <Row gap={4} style={{ alignItems: "center" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.caution }} />
            <Txt variant="small">{t("cal.rostered")}</Txt>
          </Row>
        </Row>
      </Card>

      {day ? (
        <Card>
          <Txt variant="label">{new Date(`${day}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</Txt>
          {selected.length === 0 ? <Txt variant="small">{t("cal.noFlight")}</Txt> : null}
          {selected.map((f) => (
            <Pressable key={f.id} onPress={() => (tap(), router.push({ pathname: "/flight/[id]", params: { id: f.id } }))}>
              <Row style={{ justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: "600" }}>{f.isFstd ? `${t("log.fstd")} ${f.fstdType ?? ""}` : `${f.depIcao} → ${f.arrIcao}`}</Txt>
                  <Txt variant="small">
                    {!f.isFstd && f.outUtc ? `${formatClock(f.outUtc)} – ${formatClock(f.inUtc)} UTC · ` : ""}
                    {[f.registration, f.aircraftTypeIcao, f.function].filter(Boolean).join(" · ")}
                  </Txt>
                </View>
                <Txt mono style={{ fontWeight: "700" }} color={c.accent}>{fmt(f.isFstd ? f.fstdMin : f.totalMin)}</Txt>
              </Row>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
