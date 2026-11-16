import React, { useMemo } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FTL_LIMITS, analyseFtl, buildDutyPeriods, cumulativeLevel, formatDuration } from "@cielo/core";
import { Card, Row, Screen, Txt, statusColor } from "../../src/components/ui";
import { Track } from "../../src/components/Bars";
import { Requires } from "../../src/components/Access";
import { AirportField } from "../../src/components/AirportField";
import { formatDate, type I18nKey } from "../../src/i18n";
import { useApp } from "../../src/state";
import { ftlSettingsFor } from "../../src/ftlSettings";
import { space, useTheme } from "../../src/theme";

const KEYS = ["duty7d", "duty14d", "duty28d", "flight28d", "flightYear", "flight12m"] as const;

export default function FtlScreen() {
  return (
    <Requires feature="ftl">
      <Ftl />
    </Requires>
  );
}

function Ftl() {
  const app = useApp();
  const { t, locale, flights, pilot } = app;
  const c = useTheme();
  const f = (m: number) => formatDuration(m);
  const settings = useMemo(() => ftlSettingsFor(pilot), [pilot]);
  const report = useMemo(() => analyseFtl(buildDutyPeriods(flights, settings), new Date().toISOString(), settings), [flights, settings]);
  const duties = report.duties.slice(-20).reverse();
  const hm = (iso: string) => iso.slice(11, 16);

  return (
    <Screen>
      <Card>
        <Txt variant="h2">{t("dash.ftl")}</Txt>
        {KEYS.map((k) => {
          const actual = report.cumulative[k];
          const limit = FTL_LIMITS[k];
          const level = cumulativeLevel(actual, limit);
          return (
            <View key={k} style={{ gap: 4 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt variant="muted">{t(`dash.ftl.${k}` as I18nKey)}</Txt>
                <Txt mono variant="small" color={statusColor(c, level)}>{f(actual)} / {f(limit)}</Txt>
              </Row>
              <Track ratio={limit ? actual / limit : 0} color={statusColor(c, level)} />
            </View>
          );
        })}
      </Card>

      <Card>
        <Txt variant="h2">{t("ftl.violations", { n: report.violations.length })}</Txt>
        {report.violations.length === 0 ? <Txt color={c.success}>{t("ftl.none")}</Txt> : null}
        {report.violations.slice(0, 20).map((v, i) => (
          <Row key={i} style={{ alignItems: "flex-start" }}>
            <Ionicons name="alert-circle-outline" size={18} color={v.severity === "warning" ? c.caution : c.warning} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Txt>{t(`ftl.code.${v.code}` as I18nKey, { actual: f(v.actualMin), limit: f(v.limitMin) })}</Txt>
              <Txt variant="small" mono>
                {formatDate(v.atUtc.slice(0, 10), locale)} · {hm(v.atUtc)} UTC{v.severity === "warning" && v.code === "fdpExceeded" ? ` · ${t("ftl.withinExtension")}` : ""}
              </Txt>
            </View>
          </Row>
        ))}
      </Card>

      <Card>
        <Txt variant="h2">{t("ftl.duties")}</Txt>
        {duties.length === 0 ? <Txt variant="muted">{t("dash.noFlights")}</Txt> : null}
        {duties.map((a) => {
          const over = a.fdpMin > a.maxFdpMin;
          const restShort = a.restBeforeMin !== undefined && a.minRestBeforeMin !== undefined && a.restBeforeMin < a.minRestBeforeMin;
          return (
            <View key={a.duty.id} style={{ gap: 2, paddingVertical: 2 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt mono numberOfLines={1} style={{ flex: 1 }}>
                  {formatDate(a.duty.reportUtc.slice(0, 10), locale)} · {a.duty.startIcao}→{a.duty.endIcao}
                </Txt>
                <Txt mono variant="small" color={over ? c.warning : c.text}>
                  {f(a.fdpMin)} / {Number.isFinite(a.maxFdpMin) ? f(a.maxFdpMin) : "—"}
                </Txt>
              </Row>
              <Txt variant="small" mono color={restShort ? c.warning : c.muted}>
                {t("ftl.sectors", { n: a.duty.sectors })}
                {a.splitExtensionMin ? ` · ${t("ftl.split", { m: f(a.splitExtensionMin) })}` : ""}
                {a.restBeforeMin !== undefined ? ` · ${t("ftl.rest", { r: f(a.restBeforeMin), min: f(a.minRestBeforeMin ?? 0) })}` : ""}
              </Txt>
            </View>
          );
        })}
      </Card>

      <Card>
        <Txt variant="h2">{t("ftl.settings")}</Txt>
        <AirportField label={t("more.homeBase")} value={pilot.homeBaseIcao ?? ""} onChange={(icao) => void app.savePilot({ homeBaseIcao: icao || undefined })} />
        <Txt variant="small">{t("ftl.assumptions", { report: settings.reportBeforeMin, release: settings.releaseAfterMin, tz: settings.homeTimezone })}</Txt>
      </Card>
      <Txt variant="small" style={{ paddingHorizontal: space.sm }}>{t("ftl.disclaimer")}</Txt>
    </Screen>
  );
}
