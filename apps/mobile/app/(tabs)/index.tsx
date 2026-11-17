import React, { useMemo } from "react";
import { View } from "react-native";
import { router, useIsFocused } from "expo-router";
import {
  FTL_LIMITS,
  analyseFtl,
  limitApplies,
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
import { useFtlSettings } from "../../src/ftlSettings";
import { loadDismissed, pendingDrafts } from "../../src/flightDrafts";
import { useCurrency } from "../../src/currency";
import { space, useTheme } from "../../src/theme";

const FTL_KEYS = ["duty7d", "duty14d", "duty28d", "flight28d", "flightYear", "flight12m"] as const;

export default function Dashboard() {
  const { t, locale, flights, balances, licenses, pilot, session, access, rosterEvents } = useApp();
  // roster flights that ended and are not logged yet
  // recomputed when coming back to the dashboard (a draft may have been ignored meanwhile)
  const focused = useIsFocused();
  const drafts = useMemo(() => (focused ? pendingDrafts(rosterEvents, flights, loadDismissed()) : []), [rosterEvents, flights, focused]);
  const c = useTheme();
  const today = todayUtc();
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);

  const periods = useMemo(() => dashboardPeriods(flights, balances, today), [flights, balances, today]);
  const recency = useMemo(() => computeRecency(flights, today), [flights, today]);
  // per type or class rating, with the pilot's rules (EASA / FAA)
  const currency = useCurrency();
  const { settings: ftlSettings } = useFtlSettings();
  const ftl = useMemo(() => analyseFtl(buildDutyPeriods(flights, ftlSettings), new Date().toISOString(), ftlSettings), [flights, ftlSettings]);
  const expiries = useMemo(
    () =>
      licenses
        .filter((l) => l.validUntil)
        .map((l) => ({ l, s: licenseStatus(l, today) }))
        .sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0))
        .slice(0, 4),
    [licenses, today],
  );

  // what comes next on the roster, and the flight logged last
  const nextDuty = useMemo(() => {
    const now = new Date().toISOString();
    return rosterEvents
      .filter((e) => !e.deletedAt && e.startUtc > now && ["FLIGHT", "DEADHEAD", "STANDBY", "SIM", "GROUND"].includes(e.kind))
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc))[0];
  }, [rosterEvents]);
  const lastFlight = useMemo(
    () => flights.filter((f) => !f.deletedAt && !f.isFstd).sort((a, b) => (b.outUtc ?? b.date).localeCompare(a.outUtc ?? a.date))[0],
    [flights],
  );
  const inWords = (iso: string) => {
    const h = Math.round((Date.parse(iso) - Date.now()) / 3_600_000);
    return h < 24 ? t("dash.inHours", { n: Math.max(0, h) }) : t("dash.inDays", { n: Math.round(h / 24) });
  };

  const period = (label: string, p: Totals) => (
    <Stat label={label} value={fmt(p.totalMin)} sub={t("dash.flights", { n: p.flights })} />
  );

  const recencyRow = (label: string, r: { valid: boolean; validUntil?: string; takeoffs: number; landings: number; key?: string }) => (
    <Row key={r.key ?? label} style={{ alignItems: "flex-start" }}>
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

        {drafts.length ? (
          <Card onPress={() => router.navigate("/drafts")}>
            <Row style={{ alignItems: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
                <Txt style={{ fontWeight: "800" }} color={c.onAccent}>{String(drafts.length)}</Txt>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt style={{ fontWeight: "700" }}>{t("drafts.cardTitle", { n: drafts.length })}</Txt>
                <Txt variant="small">{t("drafts.cardHint")}</Txt>
              </View>
              <Txt color={c.muted} style={{ fontSize: 20 }}>›</Txt>
            </Row>
          </Card>
        ) : null}

        {isCloudEnabled && !session ? (
          <Card>
            <Txt variant="h2">{t("dash.signInTitle")}</Txt>
            <Txt variant="muted">{t("dash.signInText")}</Txt>
            <Button title={t("dash.signIn")} onPress={() => router.push("/auth")} />
          </Card>
        ) : null}

        <Card>
          <Txt variant="label">{t("dash.totalHours")}</Txt>
          <Txt mono style={{ fontSize: 56, fontWeight: "200", letterSpacing: -1.5 }}>
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

        {nextDuty ? (
          <Card onPress={() => router.navigate("/roster")}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt variant="label">{t("dash.nextDuty")}</Txt>
              <Txt variant="small" color={c.accent} style={{ fontWeight: "600" }}>{inWords(nextDuty.reportUtc ?? nextDuty.startUtc)}</Txt>
            </Row>
            <Txt style={{ fontSize: 22, fontWeight: "700", letterSpacing: 0.3 }}>
              {nextDuty.depIcao && nextDuty.arrIcao ? `${nextDuty.depIcao}  →  ${nextDuty.arrIcao}` : nextDuty.title || t(`roster.kind.${nextDuty.kind}` as I18nKey)}
            </Txt>
            <Txt variant="small" mono>
              {formatDate(nextDuty.startUtc.slice(0, 10), locale)} · {nextDuty.startUtc.slice(11, 16)} UTC
              {nextDuty.reportUtc ? ` · ${t("dash.report")} ${nextDuty.reportUtc.slice(11, 16)}` : ""}
              {nextDuty.flightNumber ? ` · ${nextDuty.flightNumber}` : ""}
            </Txt>
          </Card>
        ) : null}

        {lastFlight ? (
          <Card onPress={() => router.push({ pathname: "/flight/[id]", params: { id: lastFlight.id } })}>
            <Txt variant="label">{t("dash.lastFlightTitle")}</Txt>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt style={{ fontSize: 20, fontWeight: "700", letterSpacing: 0.3 }}>{lastFlight.depIcao}  →  {lastFlight.arrIcao}</Txt>
              <Txt mono style={{ fontSize: 18, fontWeight: "600" }} color={c.accent}>{fmt(lastFlight.totalMin)}</Txt>
            </Row>
            <Txt variant="small">
              {formatDate(lastFlight.date, locale)}
              {[lastFlight.registration, lastFlight.aircraftTypeIcao].filter(Boolean).length ? ` · ${[lastFlight.registration, lastFlight.aircraftTypeIcao].filter(Boolean).join(" · ")}` : ""}
            </Txt>
          </Card>
        ) : null}

        <Card>
          <Row gap={space.md}>
            {period(t("dash.d28"), periods.d28)}
            {period(t("dash.d90"), periods.d90)}
            {period(t("dash.m12"), periods.m12)}
          </Row>
        </Card>

        <Card onPress={() => router.navigate("/currency")}>
          <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <Txt variant="h2">{t("dash.recency")}</Txt>
            <Txt variant="small" color={currency.alerts.length ? c.warning : c.success} style={{ fontWeight: "700" }}>
              {currency.items.length ? (currency.alerts.length ? t("cur.alerts", { n: currency.alerts.length }) : t("cur.allGood")) : ""}
            </Txt>
          </Row>
          {currency.items.length
            ? (currency.alerts.length ? currency.alerts : currency.items.filter((i) => i.kind === "passengers")).slice(0, 3).map((i) =>
                recencyRow(`${t(`cur.kind.${i.kind}` as I18nKey)}${i.group === "all" ? "" : ` · ${i.group}`}`, i),
              )
            : <>
                {recencyRow(t("dash.recencyPax"), recency.passengers)}
                {recencyRow(t("dash.recencyNight"), recency.night)}
              </>}
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

        <Card onPress={() => router.navigate("/documents")}>
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
          {FTL_KEYS.filter((k) => limitApplies(k, pilot.ftlRegime ?? "oro")).map((k) => {
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
