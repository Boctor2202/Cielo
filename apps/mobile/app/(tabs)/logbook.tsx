import React, { useMemo } from "react";
import { Alert, Pressable, SectionList, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { formatClock, formatDuration, sumFlights, type Flight } from "@cielo/core";
import { EmptyState, Fab, Row, Txt } from "../../src/components/ui";
import { formatDate, formatMonth } from "../../src/i18n";
import { useApp } from "../../src/state";
import { glass, space, useTheme } from "../../src/theme";

interface Section {
  key: string;
  title: string;
  totals: ReturnType<typeof sumFlights>;
  data: Flight[];
}

export default function Logbook() {
  const { t, locale, flights, pilot, remove } = useApp();
  const c = useTheme();
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);

  const sections = useMemo<Section[]>(() => {
    const byMonth = new Map<string, Flight[]>();
    for (const f of flights) {
      const k = f.date.slice(0, 7);
      const arr = byMonth.get(k) ?? [];
      arr.push(f);
      byMonth.set(k, arr);
    }
    return [...byMonth.entries()].map(([k, data]) => ({ key: k, title: formatMonth(k, locale), totals: sumFlights(data), data }));
  }, [flights, locale]);

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
        ListEmptyComponent={<EmptyState title={t("log.empty")} hint={t("log.emptyHint")} />}
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
      <Fab label={t("flight.new")} onPress={() => router.push("/flight/new")} />
    </View>
  );
}
