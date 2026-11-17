import React, { useMemo } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDuration } from "@cielo/core";
import { Card, EmptyState, Fab, Row, Screen, Txt } from "../../src/components/ui";
import { formatDate } from "../../src/i18n";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

/** The pilot's aircraft, with the hours and last flight logged on each. */
export default function AircraftList() {
  const { t, locale, aircraft, aircraftTypes, flights, pilot } = useApp();
  const c = useTheme();
  const rows = useMemo(() => {
    const byReg = new Map<string, { min: number; n: number; last?: string }>();
    for (const f of flights) {
      if (f.deletedAt || !f.registration) continue;
      const k = f.registration.toUpperCase();
      const e = byReg.get(k) ?? { min: 0, n: 0 };
      e.min += f.totalMin;
      e.n++;
      if (!e.last || f.date > e.last) e.last = f.date;
      byReg.set(k, e);
    }
    // one row per registration (dashes and case ignored), even if copies came in with an old import
    const norm = (r: string) => r.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const seen = new Set<string>();
    const unique = aircraft
      .filter((a) => !a.deletedAt)
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
      .filter((a) => (seen.has(norm(a.registration)) ? false : (seen.add(norm(a.registration)), true)));
    return unique
      .map((a) => ({ a, type: aircraftTypes.find((x) => x.id === a.aircraftTypeId), s: byReg.get(a.registration.toUpperCase()) }))
      .sort((x, y) => (y.s?.last ?? "").localeCompare(x.s?.last ?? "") || x.a.registration.localeCompare(y.a.registration));
  }, [aircraft, aircraftTypes, flights]);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {rows.length === 0 ? <EmptyState title={t("acft.empty")} hint={t("acft.emptyHint")} /> : null}
        {rows.map(({ a, type, s }) => (
          <Card key={a.id} onPress={() => router.push(`/aircraft/${a.id}`)}>
            <Row style={{ alignItems: "center" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt mono style={{ fontSize: 18, fontWeight: "700" }}>{a.registration}</Txt>
                <Txt variant="small">{[type ? `${type.manufacturer} ${type.model} (${type.icao})` : null, a.operator].filter(Boolean).join(" · ")}</Txt>
                <Txt variant="small" mono color={c.text}>
                  {formatDuration(s?.min ?? 0, pilot.timeDisplay)} · {t("acft.flights", { n: s?.n ?? 0 })}
                  {s?.last ? ` · ${t("acft.last", { date: formatDate(s.last, locale) })}` : ""}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Row>
          </Card>
        ))}
      </Screen>
      <Fab label={t("acft.add")} onPress={() => router.push("/aircraft/new")} />
    </View>
  );
}
