import React, { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { countryName, layoverStays, nightsByCountry } from "@cielo/core";
import { Button, Card, EmptyState, Row, Screen, Segmented, Stat, Txt } from "../../src/components/ui";
import { lookupAirport } from "../../src/airports";
import { shareFile } from "../../src/exporters";
import { formatDate } from "../../src/i18n";
import { useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

/**
 * Nights spent on layover per country and year, from the logbook: what a pilot needs for the "frais réels"
 * of the tax return (the per-country rates are applied by the pilot or their accountant).
 */
export default function Nights() {
  const { t, locale, flights, pilot } = useApp();
  const c = useTheme();
  const thisYear = new Date().getUTCFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2].map(String);
  const [year, setYear] = useState(String(thisYear - (new Date().getUTCMonth() < 6 ? 1 : 0)));
  const [open, setOpen] = useState<string | null>(null);

  const stays = useMemo(() => layoverStays(flights, pilot.homeBaseIcao, (i) => lookupAirport(i)?.country), [flights, pilot.homeBaseIcao]);
  const r = useMemo(() => nightsByCountry(stays, Number(year)), [stays, year]);
  const cname = (code: string) => (code === "??" ? t("nights.unknown") : countryName(code, locale) ?? code);

  const exportCsv = async () => {
    const lines = [
      [t("nights.country"), t("nights.nightsCol"), t("nights.staysCol"), t("nights.airportsCol")].join(";"),
      ...r.countries.map((x) => [cname(x.country), x.nights, x.stays, x.airports.join(" ")].join(";")),
      "",
      [t("nights.airportsCol"), t("nights.country"), t("nights.fromCol"), t("nights.toCol"), t("nights.nightsCol")].join(";"),
      ...r.stays.map((s) => [s.airport, cname(s.country), s.from, s.to, s.nights].join(";")),
    ];
    try {
      await shareFile(`geardown-nuitees-escale-${year}.csv`, "﻿" + lines.join("\r\n"), "text/csv", "public.comma-separated-values-text");
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <Segmented<string> value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
      {!pilot.homeBaseIcao ? <Txt variant="small" color={c.caution}>{t("nights.noBase")}</Txt> : null}
      <Card>
        <Row gap={space.md}>
          <Stat label={t("nights.total")} value={String(r.total)} />
          <Stat label={t("nights.countries")} value={String(r.countries.length)} />
        </Row>
        <Txt variant="small">{t("nights.how", { base: pilot.homeBaseIcao ?? "—" })}</Txt>
      </Card>
      {r.countries.length === 0 ? <EmptyState title={t("nights.empty")} /> : null}
      {r.countries.map((x) => (
        <Card key={x.country} onPress={() => setOpen(open === x.country ? null : x.country)}>
          <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <Txt style={{ fontWeight: "700", flex: 1 }}>{cname(x.country)}</Txt>
            <Txt mono style={{ fontWeight: "700", fontSize: 18 }} color={c.accent}>
              {t("nights.n", { n: x.nights })}
            </Txt>
          </Row>
          <Txt variant="small">{t("nights.detail", { stays: x.stays, airports: x.airports.join(", ") })}</Txt>
          {open === x.country ? (
            <View style={{ gap: 4, marginTop: space.xs }}>
              {r.stays
                .filter((s) => s.country === x.country)
                .map((s) => (
                  <Row key={`${s.airport}${s.from}`} style={{ justifyContent: "space-between" }}>
                    <Txt variant="small" mono>{s.airport}</Txt>
                    <Txt variant="small">{`${formatDate(s.from, locale)} → ${formatDate(s.to, locale)}`}</Txt>
                    <Txt variant="small" mono>{s.nights}</Txt>
                  </Row>
                ))}
            </View>
          ) : null}
        </Card>
      ))}
      {r.countries.length ? <Button kind="secondary" title={t("nights.export")} onPress={() => void exportCsv()} /> : null}
      <Pressable>
        <Txt variant="small" color={c.muted}>{t("nights.note")}</Txt>
      </Pressable>
      <View style={{ height: space.md }} />
    </Screen>
  );
}
