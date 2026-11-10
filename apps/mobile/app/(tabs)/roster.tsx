import React, { useMemo } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { formatClock, formatDuration, minutesBetween } from "@cielo/core";
import { Badge, Button, Card, EmptyState, Row, Txt } from "../../src/components/ui";
import { formatDate, type I18nKey } from "../../src/i18n";
import { useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

export default function Roster() {
  const { t, locale, rosterEvents } = useApp();
  const c = useTheme();
  const upcoming = useMemo(() => {
    const now = new Date().toISOString();
    return rosterEvents.filter((e) => e.endUtc >= now);
  }, [rosterEvents]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.bg }}
      data={upcoming}
      keyExtractor={(e) => e.id}
      contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
      ListEmptyComponent={<EmptyState title={t("roster.empty")} hint={t("roster.emptyHint")} />}
      renderItem={({ item: e }) => {
        const kindColor = e.kind === "FLIGHT" ? c.accent : e.kind === "OFF" || e.kind === "REST" || e.kind === "LEAVE" ? c.success : c.caution;
        return (
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt variant="small" mono>
                {formatDate(e.startUtc, locale)}
              </Txt>
              <Badge text={t(`roster.kind.${e.kind}` as I18nKey)} color={kindColor} />
            </Row>
            <View>
              <Txt mono style={{ fontWeight: "600", fontSize: 17 }}>
                {e.depIcao && e.arrIcao ? `${e.depIcao} → ${e.arrIcao}` : (e.title ?? t(`roster.kind.${e.kind}` as I18nKey))}
              </Txt>
              <Txt variant="small" mono>
                {[e.flightNumber, e.aircraftTypeIcao, e.aircraftReg].filter(Boolean).join(" · ")}
                {"  "}
                {formatClock(e.startUtc)}–{formatClock(e.endUtc)}Z ({formatDuration(minutesBetween(e.startUtc, e.endUtc))})
              </Txt>
            </View>
            {(e.kind === "FLIGHT" || e.kind === "SIM") && !e.flightId ? (
              <Button
                kind="secondary"
                small
                title={t("roster.log")}
                onPress={() => router.push({ pathname: "/flight/[id]", params: { id: "new", rosterEventId: e.id } })}
              />
            ) : null}
          </Card>
        );
      }}
    />
  );
}
