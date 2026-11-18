import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { distanceNm, formatDuration, groupTotals, sumFlights, type Flight } from "@cielo/core";
import { Card, Row, Screen, Segmented, Stat, Txt } from "../../src/components/ui";
import { BarRow } from "../../src/components/Bars";
import { lookupAirport } from "../../src/airports";
import { todayUtc, useApp } from "../../src/state";
import { space } from "../../src/theme";

type Range = "all" | "y" | "m12";

export default function Stats() {
  const { t, flights, pilot } = useApp();
  const [range, setRange] = useState<Range>("all");
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);
  const today = todayUtc();

  const s = useMemo(() => {
    const from = range === "y" ? `${today.slice(0, 4)}-01-01` : range === "m12" ? new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10) : "";
    const list = flights.filter((f) => !f.deletedAt && f.date >= from);
    const real = list.filter((f) => !f.isFstd);
    const totals = sumFlights(list);
    let nm = 0;
    for (const f of real) {
      const a = lookupAirport(f.depIcao);
      const b = lookupAirport(f.arrIcao);
      if (a && b) nm += distanceNm(a, b);
    }
    const fn = (["picMin", "copilotMin", "dualMin", "instructorMin"] as const).map((k) => ({ key: k, minutes: list.reduce((x, f: Flight) => x + (f[k] ?? 0), 0) }));
    return {
      totals,
      nm: Math.round(nm),
      airports: new Set(real.flatMap((f) => [f.depIcao, f.arrIcao])).size,
      byYear: groupTotals(list, "year").sort((a, b) => b.key.localeCompare(a.key)).slice(0, 8),
      byType: groupTotals(list, "aircraftTypeIcao").slice(0, 8),
      topAirports: groupTotals(real, "airport").sort((a, b) => b.flights - a.flights).slice(0, 8),
      regs: groupTotals(real, "registration").slice(0, 6),
      fn: fn.filter((x) => x.minutes > 0),
    };
  }, [flights, range, today]);

  const max = (rows: { minutes: number }[]) => Math.max(1, ...rows.map((r) => r.minutes));
  const section = (title: string, rows: { key: string; minutes: number; flights: number }[], byFlights = false) =>
    rows.length ? (
      <Card>
        <Txt variant="h2">{title}</Txt>
        {rows.map((r) => (
          <BarRow
            key={r.key}
            label={r.key}
            value={byFlights ? t("dash.flights", { n: r.flights }) : fmt(r.minutes)}
            ratio={byFlights ? r.flights / Math.max(1, ...rows.map((x) => x.flights)) : r.minutes / max(rows)}
          />
        ))}
      </Card>
    ) : null;

  return (
    <Screen columns>
      <Segmented<Range>
        value={range}
        onChange={setRange}
        options={[
          { value: "all", label: t("stats.all") },
          { value: "y", label: today.slice(0, 4) },
          { value: "m12", label: t("dash.m12") },
        ]}
      />
      <Card>
        <Row gap={space.md}>
          <Stat label={t("stats.hours")} value={fmt(s.totals.totalMin)} sub={t("dash.flights", { n: s.totals.flights })} />
          <Stat label={t("stats.distance")} value={`${s.nm.toLocaleString()} NM`} sub={t("stats.airportsCount", { n: s.airports })} />
        </Row>
        <Row gap={space.md}>
          <Stat label={t("dash.night")} value={fmt(s.totals.nightMin)} />
          <Stat label={t("dash.ifr")} value={fmt(s.totals.ifrMin)} />
          <Stat label={t("dash.landings")} value={String(s.totals.landingsDay + s.totals.landingsNight)} />
        </Row>
      </Card>
      {s.fn.length ? (
        <Card>
          <Txt variant="h2">{t("stats.byFunction")}</Txt>
          {s.fn.map((r) => (
            <BarRow key={r.key} label={t(`stats.fn.${r.key}` as never)} value={fmt(r.minutes)} ratio={r.minutes / max(s.fn)} />
          ))}
        </Card>
      ) : null}
      {section(t("stats.byYear"), s.byYear)}
      {section(t("stats.byType"), s.byType)}
      {section(t("stats.airports"), s.topAirports, true)}
      {section(t("stats.registrations"), s.regs)}
      <View style={{ height: space.md }} />
    </Screen>
  );
}
