import React, { useMemo } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  FTL_LIMITS,
  analyseFtl,
  buildDutyPeriods,
  computeRecency,
  cumulativeLevel,
  dashboardPeriods,
  formatDuration,
  licenseStatus,
  type Totals,
} from "@cielo/core";
import { Button, Card, Dot, Fab, Row, Screen, Stat, Txt, statusColor } from "../../src/components/ui";
import { formatDate, type I18nKey } from "../../src/i18n";
import { isCloudEnabled } from "../../src/auth";
import { AccessBanner } from "../../src/components/Access";
import { todayUtc, useApp } from "../../src/state";
import { ftlSettingsFor } from "../../src/ftlSettings";
import { space, useTheme } from "../../src/theme";

const FTL_KEYS = ["duty7d", "duty14d", "duty28d", "flight28d", "flightYear", "flight12m"] as const;

export default function Dashboard() {
  const { t, locale, flights, balances, licenses, pilot, session, access } = useApp();
  const c = useTheme();
  const today = todayUtc();
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);

  const periods = useMemo(() => dashboardPeriods(flights, balances, today), [flights, balances, today]);
  const recency = useMemo(() => computeRecency(flights, today), [flights, today]);
  const ftl = useMemo(() => {
    const settings = ftlSettingsFor(pilot);
    return analyseFtl(buildDutyPeriods(flights, settings), new Date().toISOString(), settings);
  }, [flights, pilot]);
  const expiries = useMemo(
    () =>
      licenses
        .filter((l) => l.validUntil)
        .map((l) => ({ l, s: licenseStatus(l, today) }))
        .sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0))
        .slice(0, 4),
    [licenses, today],
  );

  const period = (label: string, p: Totals) => (
    <Stat label={label} value={fmt(p.totalMin)} sub={t("dash.flights", { n: p.flights })} />
  );

  const recencyRow = (label: string, r: typeof recency.passengers) => (
    <Row style={{ alignItems: "flex-start" }}>
      <View style={{ paddingTop: 5 }}>
        <Dot color={r.valid ? c.success : c.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt>{label}</Txt>
        <Txt variant="small" mono color={r.valid ? c.muted : c.warning}>
          {r.valid && r.validUntil
            ? t("dash.validUntil", { date: formatDate(r.validUntil, locale) })
            : t("dash.notCurrent", { t: r.takeoffs, l: r.landings })}
        </Txt>
      </View>
    </Row>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ gap: 2, marginTop: 4 }}>
          <Txt variant="muted">{locale === "fr" ? "Bonjour" : "Hello"} {pilot.fullName?.split(" ")[0] ?? ""}</Txt>
          <Txt variant="title">{locale === "fr" ? "Vue d'ensemble" : "Overview"}</Txt>
        </View>

        <AccessBanner />

        {isCloudEnabled && !session ? (
          <Card>
            <Txt variant="h2">{t("dash.signInTitle")}</Txt>
            <Txt variant="muted">{t("dash.signInText")}</Txt>
            <Button title={t("dash.signIn")} onPress={() => router.push("/auth")} />
          </Card>
        ) : null}

        <Card>
          <Txt variant="label">{t("dash.totalHours")}</Txt>
          <Txt mono style={{ fontSize: 52, fontFamily: "Manrope_400Regular", letterSpacing: -2 }}>
            {fmt(periods.all.totalMin)}
          </Txt>
          <Row gap={space.lg}>
            <Stat label={t("dash.pic")} value={fmt(periods.all.picMin)} />
            <Stat label={t("dash.night")} value={fmt(periods.all.nightMin)} />
            <Stat label={t("dash.ifr")} value={fmt(periods.all.ifrMin)} />
          </Row>
          <Txt variant="small">
            {t("dash.flights", { n: periods.all.flights })} · {t("dash.landings")}{" "}
            {periods.all.landingsDay + periods.all.landingsNight}
          </Txt>
        </Card>

        <Card>
          <Row gap={space.md}>
            {period(t("dash.d28"), periods.d28)}
            {period(t("dash.d90"), periods.d90)}
            {period(t("dash.m12"), periods.m12)}
          </Row>
        </Card>

        <Card>
          <Txt variant="h2">{t("dash.recency")}</Txt>
          {recencyRow(t("dash.recencyPax"), recency.passengers)}
          {recencyRow(t("dash.recencyNight"), recency.night)}
          {recency.lastFlightDate ? (
            <Txt variant="small">
              {t("dash.lastFlight", { date: formatDate(recency.lastFlightDate, locale), n: recency.daysSinceLastFlight ?? 0 })}
            </Txt>
          ) : (
            <View style={{ gap: space.sm }}>
              <Txt variant="muted">{t("dash.noFlights")}</Txt>
              <Button title={t("dash.addFirst")} onPress={() => router.push("/flight/new")} />
            </View>
          )}
        </Card>

        <Card onPress={() => router.push("/documents")}>
          <Txt variant="h2">{t("dash.expiries")}</Txt>
          {expiries.length === 0 ? <Txt variant="muted">{t("dash.noDocuments")}</Txt> : null}
          {expiries.map(({ l, s }) => (
            <Row key={l.id} style={{ justifyContent: "space-between" }}>
              <Row style={{ flex: 1 }}>
                <Dot color={statusColor(c, s.state)} />
                <Txt numberOfLines={1} style={{ flex: 1 }}>
                  {l.code}
                </Txt>
              </Row>
              <Txt mono variant="small" color={statusColor(c, s.state)}>
                {formatDate(l.validUntil!, locale)}
              </Txt>
            </Row>
          ))}
        </Card>

        <Card>
          <Txt variant="h2">{t("dash.ftl")}</Txt>
          {FTL_KEYS.map((k) => {
            const actual = ftl.cumulative[k];
            const limit = FTL_LIMITS[k];
            const level = cumulativeLevel(actual, limit);
            const pct = Math.min(1, limit ? actual / limit : 0);
            return (
              <View key={k} style={{ gap: 4 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt variant="muted">{t(`dash.ftl.${k}` as I18nKey)}</Txt>
                  <Txt mono variant="small" color={statusColor(c, level)}>
                    {formatDuration(actual)} / {formatDuration(limit)}
                  </Txt>
                </Row>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,22,38,0.10)" }}>
                  <View style={{ height: 6, borderRadius: 3, width: `${pct * 100}%`, backgroundColor: statusColor(c, level) }} />
                </View>
              </View>
            );
          })}
          <Txt variant="small">{t("dash.ftl.note")}</Txt>
        </Card>
      </Screen>
      <Fab label={t("flight.new")} onPress={() => router.push(access.canWrite ? "/flight/new" : "/subscription")} />
    </View>
  );
}
