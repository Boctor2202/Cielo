import React, { useMemo, useState } from "react";
import { Alert, Pressable, SectionList, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { formatClock, formatDuration, sumFlights, type Flight } from "@cielo/core";
import { EmptyState, Fab, Row, Txt } from "../../src/components/ui";
import { formatDate, formatMonth } from "../../src/i18n";
import { useApp } from "../../src/state";
import { font, glass, space, useTheme } from "../../src/theme";

interface Section {
  key: string;
  title: string;
  totals: ReturnType<typeof sumFlights>;
  data: Flight[];
}

export default function Logbook() {
  const { access, t, locale, flights, pilot, remove } = useApp();
  const c = useTheme();
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);

  const [q, setQ] = useState("");
  /** Words all found in the flight: airports, registration, type, flight number, crew, remarks, date. */
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return flights;
    return flights.filter((f) => {
      const hay = [f.depIcao, f.arrIcao, f.registration, f.aircraftTypeIcao, f.flightNumber, f.picName, f.remarks, f.function, f.date].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [flights, q]);

  const sections = useMemo<Section[]>(() => {
    const byMonth = new Map<string, Flight[]>();
    for (const f of shown) {
      const k = f.date.slice(0, 7);
      const arr = byMonth.get(k) ?? [];
      arr.push(f);
      byMonth.set(k, arr);
    }
    return [...byMonth.entries()].map(([k, data]) => ({ key: k, title: formatMonth(k, locale), totals: sumFlights(data), data }));
  }, [shown, locale]);

  const confirmDelete = (f: Flight) =>
    Alert.alert(t("log.deleteTitle"), t("log.deleteBody", { route: `${f.depIcao}–${f.arrIcao}`, date: formatDate(f.date, locale) }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => void remove("flights", f.id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <SectionList
        sections={sections}
        keyExtractor={(f) => f.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 140, paddingTop: space.sm, flexGrow: 1 }}
        ListHeaderComponent={
          flights.length ? (
            <View style={{ marginHorizontal: space.md, marginTop: space.sm }}>
              <Row style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: glass(c).strong }}>
                <Ionicons name="search" size={16} color={c.muted} />
                <TextInput
                  style={{ flex: 1, color: c.text, ...font.regular, fontSize: 15 }}
                  placeholder={t("log.search")}
                  placeholderTextColor={c.muted}
                  value={q}
                  onChangeText={setQ}
                  autoCorrect={false}
                  autoCapitalize="characters"
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                />
              </Row>
              {q.trim() ? (
                <Txt variant="small" style={{ marginTop: 6, marginLeft: 4 }}>
                  {t("log.found", { n: shown.length, time: fmt(sumFlights(shown).totalMin) })}
                </Txt>
              ) : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={q.trim() ? <EmptyState title={t("log.noMatch")} /> : <EmptyState title={t("log.empty")} hint={t("log.emptyHint")} />}
        renderSectionHeader={({ section }) => (
          <Row style={{ justifyContent: "space-between", marginHorizontal: space.md, marginTop: space.md, paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: 14, backgroundColor: glass(c).strong }}>
            <Txt variant="h2" style={{ fontSize: 15 }}>
              {section.title}
            </Txt>
            <Txt mono variant="small">
              {t("log.monthTotal", {
                n: section.totals.flights + section.totals.fstdSessions,
                time: fmt(section.totals.totalMin),
              })}
            </Txt>
          </Row>
        )}
        renderItem={({ item: f }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/flight/[id]", params: { id: f.id } })}
            onLongPress={() => confirmDelete(f)}
            delayLongPress={350}
            style={({ pressed }) => ({
              marginHorizontal: space.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: glass(c).edge,
              backgroundColor: pressed ? glass(c).pane : glass(c).strong,
            })}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <Row gap={space.md} style={{ flex: 1 }}>
                <Txt mono variant="small" style={{ width: 58 }}>
                  {formatDate(f.date, locale).slice(0, 6)}
                </Txt>
                <View style={{ flex: 1 }}>
                  <Txt mono style={{ fontWeight: "600", fontSize: 15.5 }}>
                    {f.isFstd ? `${t("log.fstd")} ${f.fstdType ?? ""}` : `${f.depIcao} → ${f.arrIcao}`}
                  </Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {[f.registration, f.aircraftTypeIcao, f.function, f.flightNumber].filter(Boolean).join(" · ")}
                    {!f.isFstd && f.outUtc ? `  ${formatClock(f.outUtc)}–${formatClock(f.inUtc)}Z` : ""}
                  </Txt>
                </View>
              </Row>
              <View style={{ alignItems: "flex-end" }}>
                <Txt mono style={{ fontWeight: "600" }}>
                  {fmt(f.isFstd ? f.fstdMin : f.totalMin)}
                </Txt>
                {f.nightMin > 0 ? (
                  <Txt mono variant="small" color={c.accent}>
                    ☾ {fmt(f.nightMin)}
                  </Txt>
                ) : null}
              </View>
            </Row>
          </Pressable>
        )}
      />
      <Fab label={t("flight.new")} onPress={() => router.push(access.canWrite ? "/flight/new" : "/subscription")} />
    </View>
  );
}
