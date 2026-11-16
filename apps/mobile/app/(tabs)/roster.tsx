import React, { useMemo } from "react";
import { SectionList, View } from "react-native";
import { router } from "expo-router";
import { formatClock, formatDuration, minutesBetween } from "@cielo/core";
import { Button, EmptyState, Glass, Row, Txt } from "../../src/components/ui";
import { formatDate, type I18nKey } from "../../src/i18n";
import { useApp } from "../../src/state";
import { Requires } from "../../src/components/Access";
import { space, useTheme } from "../../src/theme";

export default function Roster() {
  return (
    <Requires feature="roster">
      <RosterScreen />
    </Requires>
  );
}

function RosterScreen() {
  const { t, locale, rosterEvents } = useApp();
  const c = useTheme();
  const days = useMemo(() => {
    const now = new Date().toISOString();
    const by = new Map<string, typeof rosterEvents>();
    for (const e of rosterEvents.filter((x) => !x.deletedAt && x.endUtc >= now).sort((x, y) => x.startUtc.localeCompare(y.startUtc))) {
      const k = e.startUtc.slice(0, 10);
      by.set(k, [...(by.get(k) ?? []), e]);
    }
    return [...by.entries()].map(([day, data]) => ({ day, data }));
  }, [rosterEvents]);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const dayTitle = (d: string) =>
    d === today ? t("common.today") : d === tomorrow ? t("roster.tomorrow") : new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const kindColor = (k: string) => (k === "FLIGHT" ? c.accent : k === "DEADHEAD" ? "#64D2FF" : k === "SIM" ? "#BF5AF2" : k === "STANDBY" ? c.caution : k === "OFF" || k === "REST" || k === "LEAVE" ? c.muted : "#0A84FF");

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: "transparent" }}
      sections={days}
      keyExtractor={(e) => e.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 140, flexGrow: 1 }}
      ListEmptyComponent={<EmptyState title={t("roster.empty")} hint={t("roster.emptyHint")} />}
      renderSectionHeader={({ section }) => (
        <Txt style={{ fontSize: 20, fontWeight: "700", marginTop: space.lg, marginBottom: space.sm, textTransform: "capitalize" }}>{dayTitle(section.day)}</Txt>
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item: e }) => {
        const color = kindColor(e.kind);
        const rest = e.kind === "OFF" || e.kind === "REST" || e.kind === "LEAVE";
        return (
          <Glass>
            <Row style={{ alignItems: "stretch", gap: 0 }}>
              {/* coloured rail: what kind of duty */}
              <View style={{ width: 5, backgroundColor: color }} />
              <View style={{ width: 64, paddingVertical: 12, alignItems: "center" }}>
                <Txt mono style={{ fontWeight: "700" }}>{formatClock(e.reportUtc ?? e.startUtc)}</Txt>
                {!rest ? <Txt mono variant="small">{formatClock(e.endUtc)}</Txt> : null}
              </View>
              <View style={{ flex: 1, paddingVertical: 12, paddingRight: 14, gap: 3 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt style={{ fontSize: rest ? 15 : 17, fontWeight: rest ? "500" : "700", letterSpacing: 0.3 }} numberOfLines={1}>
                    {e.depIcao && e.arrIcao ? `${e.depIcao}  →  ${e.arrIcao}` : (e.title ?? t(`roster.kind.${e.kind}` as I18nKey))}
                  </Txt>
                  <Txt variant="small" color={color} style={{ fontWeight: "700" }}>{t(`roster.kind.${e.kind}` as I18nKey)}</Txt>
                </Row>
                {!rest ? (
                  <Txt variant="small" mono numberOfLines={1}>
                    {[e.flightNumber, e.aircraftTypeIcao, e.aircraftReg].filter(Boolean).join(" · ")}
                    {[e.flightNumber, e.aircraftTypeIcao, e.aircraftReg].some(Boolean) ? " · " : ""}
                    {formatDuration(minutesBetween(e.startUtc, e.endUtc))} · UTC
                  </Txt>
                ) : null}
                {(e.kind === "FLIGHT" || e.kind === "SIM") && !e.flightId && e.startUtc < new Date().toISOString() ? (
                  <Button kind="secondary" small title={t("roster.log")} onPress={() => router.push({ pathname: "/flight/[id]", params: { id: "new", rosterEventId: e.id } })} />
                ) : null}
              </View>
            </Row>
          </Glass>
        );
      }}
    />
  );
}
