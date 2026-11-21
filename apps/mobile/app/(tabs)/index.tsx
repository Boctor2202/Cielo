import React, { useEffect, useMemo, useState } from "react";
import { Roll } from "../../src/components/Roll";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useIsFocused } from "expo-router";
import {
  FTL_LIMITS,
  analyseFtl,
  limitApplies,
  buildDutyPeriods,
  computeRecency,
  cumulativeLevel,
  dashboardPeriods,
  defaultGoals,
  formatDuration,
  goalProgress,
  pilotFirstName,
  dayPart,
  licenseStatus,
  closestBadges,
  dashboardValue,
  dashboardWidgets,
  discoveryBadges,
  hiddenWidgets,
  hoursByOperator,
  hoursByType,
  moveWidget,
  nextLayover,
  placesVisited,
  widgetLabel,
  widgetSpec,
  type Totals,
  type WidgetId,
  type WidgetPlacement,
  isDemoAccount,
} from "@cielo/core";
import { Button, Card, Dot, Row, Screen, Txt, statusColor } from "../../src/components/ui";
import { Track } from "../../src/components/Bars";
import { DutyCard, HeroCard, LastFlightCard, PeriodTiles } from "../../src/components/Overview";
import { formatDate, type I18nKey } from "../../src/i18n";
import { isCloudEnabled } from "../../src/auth";
import { AccessBanner } from "../../src/components/Access";
import { todayUtc, useApp } from "../../src/state";
import { useFtlSettings } from "../../src/ftlSettings";
import { loadDismissed, pendingDrafts } from "../../src/flightDrafts";
import { useCurrency } from "../../src/currency";
import { space, useTheme, withAlpha } from "../../src/theme";
import { lookupAirport } from "../../src/airports";
import { Emblem } from "../../src/components/Achievements";
import { CityPhoto } from "../../src/components/CityPhoto";

/** Each widget's icon and colour, as on the website, so the cards read at a glance ("" = the pilot's colour). */
const LOOK: Record<WidgetId, { icon: React.ComponentProps<typeof Ionicons>["name"]; tone: string }> = {
  hero: { icon: "time-outline", tone: "" },
  periods: { icon: "speedometer-outline", tone: "#38BDF8" },
  nextDuty: { icon: "calendar-outline", tone: "#A78BFA" },
  lastFlight: { icon: "airplane-outline", tone: "" },
  recency: { icon: "shield-checkmark-outline", tone: "#F59E0B" },
  expiries: { icon: "document-text-outline", tone: "#F87171" },
  ftl: { icon: "checkmark-done-circle-outline", tone: "#34D399" },
  byType: { icon: "airplane", tone: "#60A5FA" },
  countries: { icon: "globe-outline", tone: "#2DD4BF" },
  byOperator: { icon: "business-outline", tone: "#F472B6" },
  nextLayover: { icon: "bed-outline", tone: "#FB923C" },
  nextBadge: { icon: "medal-outline", tone: "#A78BFA" },
  jobs: { icon: "briefcase-outline", tone: "#FACC15" },
};

/** A card's title row: the widget's icon in its colour, the title, an optional chip, and a chevron. */
function Head({ id, title, chip, go }: { id: WidgetId; title: string; chip?: string; go?: boolean }) {
  const c = useTheme();
  const look = { ...LOOK[id], tone: LOOK[id].tone || c.accent };
  return (
    <Row style={{ alignItems: "center", gap: 10 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: `${look.tone}26` }}>
        <Ionicons name={look.icon} size={16} color={look.tone} />
      </View>
      <Txt variant="h2" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
      {chip ? (
        <View style={{ borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: `${look.tone}26` }}>
          <Txt mono style={{ fontSize: 11, fontWeight: "700" }} color={look.tone}>{chip}</Txt>
        </View>
      ) : null}
      {go ? <Ionicons name="chevron-forward" size={16} color={c.muted} /> : null}
    </Row>
  );
}

const FTL_KEYS = ["duty7d", "duty14d", "duty28d", "flight28d", "flightYear", "flight12m"] as const;

export default function Dashboard() {
  const { t, locale, flights, balances, licenses, pilot, session, access, rosterEvents, layovers, savePilot, store } = useApp();
  // signed out without having asked (session expired, or revoked from another device): the logbook on the phone
  // still belongs to an account, so ask to sign back in rather than offer to "find the website's flights"
  const [hadAccount, setHadAccount] = useState(false);
  useEffect(() => {
    if (session || !store) return;
    void store.getMeta("sync.accountOwner").then((v) => setHadAccount(!!v)).catch(() => undefined);
  }, [session, store]);
  // the pilot's widgets (synced with the website); while customising, a draft
  const saved = useMemo(() => dashboardWidgets(pilot), [pilot]);
  const [draft, setDraft] = useState<WidgetPlacement[] | null>(null);
  const widgets = draft ?? saved;
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
  // the ring: the pilot's total-time goal, else the next round milestone
  const goal = useMemo(() => {
    const g = (pilot.goals ?? []).find((x) => x.kind === "total") ?? defaultGoals(flights, balances)[0];
    return g ? goalProgress(g, flights, balances, today) : undefined;
  }, [pilot.goals, flights, balances, today]);
  const byType = useMemo(() => hoursByType(flights), [flights]);
  const byOperator = useMemo(() => hoursByOperator(flights), [flights]);
  const places = useMemo(() => placesVisited(flights, (i) => lookupAirport(i)?.country), [flights]);
  const nearBadges = useMemo(() => closestBadges(discoveryBadges(flights, lookupAirport), 3), [flights]);
  const badge = nearBadges[0];
  const layover = useMemo(() => nextLayover(layovers, new Date().toISOString()), [layovers]);
  const inWords = (iso: string) => {
    const h = Math.round((Date.parse(iso) - Date.now()) / 3_600_000);
    return h < 24 ? t("dash.inHours", { n: Math.max(0, h) }) : t("dash.inDays", { n: Math.round(h / 24) });
  };

  const period = (label: string, p: Totals, color: string) => ({ label, value: fmt(p.totalMin), sub: t("dash.flights", { n: p.flights }), color });

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

  // each widget in its large form (the Overview as it was) and its small tile
  const ftlLimit = (k: (typeof FTL_KEYS)[number]) => ({ actual: ftl.cumulative[k], limit: FTL_LIMITS[k] });
  const large: Partial<Record<WidgetId, React.ReactNode>> = {
    hero: (
      <HeroCard
          all={periods.all}
          flights={flights}
          goal={goal}
          timeDisplay={pilot.timeDisplay}
          t={t as never}
          monthLabel={t("dash.m12")}
          locale={locale}
        />
    ),
    periods: (
      <Pressable onPress={() => router.navigate("/stats")} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <PeriodTiles items={[period(t("dash.d28"), periods.d28, "#38BDF8"), period(t("dash.d90"), periods.d90, "#818CF8"), period(t("dash.m12"), periods.m12, c.accent)]} />
      </Pressable>
    ),
    nextDuty: nextDuty ? (
          <DutyCard
            title={t("dash.nextDuty")}
            from={nextDuty.depIcao ?? undefined}
            to={nextDuty.arrIcao ?? undefined}
            label={nextDuty.title || t(`roster.kind.${nextDuty.kind}` as I18nKey)}
            countdown={inWords(nextDuty.reportUtc ?? nextDuty.startUtc)}
            chips={[
              formatDate(nextDuty.startUtc.slice(0, 10), locale),
              `${nextDuty.startUtc.slice(11, 16)} UTC`,
              ...(nextDuty.reportUtc ? [`${t("dash.report")} ${nextDuty.reportUtc.slice(11, 16)}`] : []),
              ...(nextDuty.flightNumber ? [nextDuty.flightNumber] : []),
            ]}
            onPress={() => router.navigate("/roster")}
          />
        ) : null,
    lastFlight: lastFlight ? (
          <LastFlightCard
            title={t("dash.lastFlightTitle")}
            f={lastFlight}
            time={fmt(lastFlight.totalMin)}
            date={formatDate(lastFlight.date, locale)}
            onPress={() => router.push({ pathname: "/flight/[id]", params: { id: lastFlight.id } })}
          />
        ) : null,
    recency: (
      <Card onPress={() => router.navigate("/currency")}>
          <Head id="recency" title={t("dash.recency")} chip={currency.items.length ? (currency.alerts.length ? t("cur.alerts", { n: currency.alerts.length }) : t("cur.allGood")) : undefined} go />
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
    ),
    expiries: (
      <Card onPress={() => router.navigate("/documents")}>
          <Head id="expiries" title={t("dash.expiries")} chip={expiries[0]?.s.daysLeft !== undefined ? (expiries[0]!.s.daysLeft! < 0 ? t("dash.expired") : t("dash.daysLeft", { n: expiries[0]!.s.daysLeft! })) : undefined} go />
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
    ),
    ftl: (
      <Card onPress={() => router.navigate("/ftl")}>
          <Head id="ftl" title={t("dash.ftl")} go />
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
                <Track ratio={pct} color={statusColor(c, level)} />
              </View>
            );
          })}
          <Txt variant="small">{t("dash.ftl.note")}</Txt>
        </Card>
    ),
    byType: byType.length ? (
      <Card onPress={() => router.navigate("/stats")}>
        <Head id="byType" title={widgetLabel("byType", locale)} go />
        {byType.map((x) => (
          <View key={x.key} style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt mono style={{ fontWeight: "700" }}>{x.key}</Txt>
              <Txt mono variant="small">{fmt(x.minutes)} · {t("dash.flights", { n: x.flights })}</Txt>
            </Row>
            <Track ratio={x.minutes / (byType[0]?.minutes || 1)} color={c.accent} />
          </View>
        ))}
      </Card>
    ) : null,
    nextBadge: nearBadges.length ? (
      <Card onPress={() => router.navigate("/stats")}>
        <Head id="nextBadge" title={t("dash.nextBadges")} go />
        {nearBadges.map((b) => (
          <Row key={b.id} style={{ alignItems: "center", gap: 12 }}>
            <Emblem badge={b} size={40} />
            <View style={{ flex: 1, gap: 3 }}>
              <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <Txt style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>{t(`badges.d.${b.id}` as I18nKey)}</Txt>
                <Txt mono variant="small">{Math.round(b.value).toLocaleString()} / {b.target.toLocaleString()}</Txt>
              </Row>
              <Txt variant="small" numberOfLines={1}>{t(`badges.dd.${b.id}` as I18nKey)} · {t("dash.badgeLeft", { n: Math.round(b.target - b.value).toLocaleString() })}</Txt>
              <Track ratio={Math.max(0.02, b.value / b.target)} color="#A78BFA" />
            </View>
          </Row>
        ))}
      </Card>
    ) : null,
    byOperator: byOperator.length ? (
      <Card onPress={() => router.navigate("/logbook")}>
        <Head id="byOperator" title={widgetLabel("byOperator", locale)} go />
        {byOperator.map((x) => (
          <View key={x.key} style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt numberOfLines={1} style={{ flex: 1, fontWeight: "700" }}>{x.key === "—" ? t("dash.noOperator") : x.key}</Txt>
              <Txt mono variant="small">{fmt(x.minutes)}</Txt>
            </Row>
            <Track ratio={x.minutes / (byOperator[0]?.minutes || 1)} color="#818CF8" />
          </View>
        ))}
      </Card>
    ) : null,
  };
  // the small tiles: a figure and what it is
  const small: Partial<Record<WidgetId, { value: string; sub?: string; color?: string; chip?: string; go?: () => void }>> = {
    hero: { value: fmt(periods.all.totalMin), sub: t("dash.flights", { n: periods.all.flights }), go: () => router.navigate("/stats") },
    periods: { value: fmt(periods.d28.totalMin), sub: t("dash.d28"), color: "#38BDF8", go: () => router.navigate("/stats") },
    nextDuty: nextDuty ? { value: nextDuty.depIcao && nextDuty.arrIcao ? `${nextDuty.depIcao} → ${nextDuty.arrIcao}` : nextDuty.title || t(`roster.kind.${nextDuty.kind}` as I18nKey), sub: `${formatDate(nextDuty.startUtc.slice(0, 10), locale)} · ${nextDuty.startUtc.slice(11, 16)} UTC`, chip: inWords(nextDuty.reportUtc ?? nextDuty.startUtc), go: () => router.navigate("/roster") } : undefined,
    lastFlight: lastFlight ? { value: `${lastFlight.depIcao} → ${lastFlight.arrIcao}`, sub: `${formatDate(lastFlight.date, locale)}${lastFlight.registration ? ` · ${lastFlight.registration}` : ""}`, chip: fmt(lastFlight.totalMin), go: () => router.push({ pathname: "/flight/[id]", params: { id: lastFlight.id } }) } : undefined,
    recency: { value: currency.alerts.length ? t("cur.alerts", { n: currency.alerts.length }) : t("cur.allGood"), color: currency.alerts.length ? c.warning : c.success, go: () => router.navigate("/currency") },
    expiries: expiries[0] ? { value: expiries[0].l.code, sub: formatDate(expiries[0].l.validUntil!, locale), color: statusColor(c, expiries[0].s.state), chip: expiries[0].s.daysLeft !== undefined ? (expiries[0].s.daysLeft < 0 ? t("dash.expired") : t("dash.daysLeft", { n: expiries[0].s.daysLeft })) : undefined, go: () => router.navigate("/documents") } : undefined,
    ftl: { value: `${formatDuration(ftlLimit("flight28d").actual)} / ${formatDuration(ftlLimit("flight28d").limit)}`, sub: t("dash.ftl.flight28d"), color: statusColor(c, cumulativeLevel(ftlLimit("flight28d").actual, ftlLimit("flight28d").limit)), go: () => router.navigate("/ftl") },
    byType: byType[0] ? { value: byType[0].key, sub: fmt(byType[0].minutes), go: () => router.navigate("/stats") } : undefined,
    countries: { value: String(places.countries.length), sub: t("dash.places", { a: places.airports }), color: c.accent, go: () => router.navigate("/stats") },
    byOperator: byOperator[0] ? { value: byOperator[0].key === "—" ? t("dash.noOperator") : byOperator[0].key, sub: fmt(byOperator[0].minutes), go: () => router.navigate("/logbook") } : undefined,
    nextLayover: layover ? { value: layover.airportIcao, sub: layover.arrivalUtc ? formatDate(layover.arrivalUtc.slice(0, 10), locale) : layover.hotelName, go: () => router.navigate("/layovers") } : { value: "—", sub: t("dash.noLayover"), go: () => router.navigate("/layovers") },
    nextBadge: badge ? { value: t(`badges.d.${badge.id}` as I18nKey), sub: `${badge.value} / ${badge.target}`, color: "#A78BFA", go: () => router.navigate("/stats") } : undefined,
    jobs: { value: t("dash.jobsValue"), sub: t("dash.jobsSub"), color: c.accent, go: () => router.navigate("/jobs") },
  };
  const tile = (id: WidgetId) => {
    // the next layover: its city's landmark (Google photo) across the top
    if (id === "nextLayover" && layover && access.has("jobs"))
      return (
        <Card onPress={() => router.navigate("/layovers")} style={{ flex: 1, gap: 4, paddingTop: 0, overflow: "hidden" }}>
          <View style={{ marginHorizontal: -18, marginBottom: 6 }}>
            <CityPhoto icao={layover.airportIcao} height={86} />
          </View>
          <Txt variant="small" numberOfLines={1} style={{ fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", fontSize: 10 }}>{widgetLabel(id, locale)}</Txt>
          <Txt numberOfLines={1} style={{ fontSize: 18, fontWeight: "800" }}>{lookupAirport(layover.airportIcao)?.city || layover.airportIcao}</Txt>
          <Txt variant="small" numberOfLines={1}>{[layover.airportIcao, layover.arrivalUtc ? formatDate(layover.arrivalUtc.slice(0, 10), locale) : layover.hotelName].filter(Boolean).join(" · ")}</Txt>
        </Card>
      );
    // the next badge: its emblem, what it takes, how far along
    if (id === "nextBadge" && badge)
      return (
        <Card onPress={() => router.navigate("/stats")} style={{ flex: 1, minHeight: 92, gap: 4 }}>
          <Txt variant="small" numberOfLines={1} style={{ fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", fontSize: 10.5 }}>{widgetLabel(id, locale)}</Txt>
          <Row style={{ alignItems: "center", gap: 8 }}>
            <Emblem badge={badge} size={30} />
            <Txt numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: "800" }} color="#A78BFA">{t(`badges.d.${badge.id}` as I18nKey)}</Txt>
          </Row>
          <Txt variant="small" numberOfLines={2}>{t(`badges.dd.${badge.id}` as I18nKey)} · {t("dash.badgeLeft", { n: Math.round(badge.target - badge.value).toLocaleString() })}</Txt>
          <Track ratio={Math.max(0.02, badge.value / badge.target)} color="#A78BFA" />
        </Card>
      );
    const x = small[id];
    if (!x) return null;
    const locked = !!widgetSpec(id).max && !access.has("jobs");
    return (
      <Card onPress={locked ? () => router.push("/subscription") : x.go} style={{ flex: 1, minHeight: 104, gap: 6 }}>
        <Row style={{ alignItems: "center", gap: 7 }}>
          <View style={{ width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: `${(LOOK[id].tone || c.accent)}26` }}>
            <Ionicons name={LOOK[id].icon} size={13} color={(LOOK[id].tone || c.accent)} />
          </View>
          <Txt variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", fontSize: 10 }}>{widgetLabel(id, locale)}</Txt>
          {x.go || locked ? <Ionicons name="chevron-forward" size={13} color={c.muted} /> : null}
        </Row>
        <Txt numberOfLines={1} style={{ fontSize: 20, fontWeight: "800" }} color={locked ? c.muted : x.color}>{locked ? "Max" : x.value}</Txt>
        <Row style={{ alignItems: "center", gap: 6 }}>
          {x.sub && !locked ? <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>{x.sub}</Txt> : <View style={{ flex: 1 }} />}
          {x.chip && !locked ? (
            <View style={{ borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: `${(LOOK[id].tone || c.accent)}26` }}>
              <Txt mono style={{ fontSize: 10.5, fontWeight: "700" }} color={(LOOK[id].tone || c.accent)}>{x.chip}</Txt>
            </View>
          ) : null}
        </Row>
      </Card>
    );
  };
  // a large widget without a large form (or nothing to show) falls back to its tile
  const block = (w: WidgetPlacement) => (w.size === "l" ? (large[w.id] ?? tile(w.id)) : tile(w.id));
  // small tiles side by side, two per row
  const rows: WidgetPlacement[][] = [];
  for (const w of widgets) {
    const lastRow = rows[rows.length - 1];
    if (w.size === "s" && lastRow && lastRow.length === 1 && lastRow[0]!.size === "s") lastRow.push(w);
    else rows.push([w]);
  }
  const editing = draft !== null;
  const save = async () => {
    if (draft) await savePilot({ dashboard: dashboardValue(draft) });
    setDraft(null);
  };
  const edit = (i: number, w: WidgetPlacement) => (
    <Row style={{ justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, marginBottom: -4 }}>
      <Txt variant="small" style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>{widgetLabel(w.id, locale)}</Txt>
      <Row style={{ gap: 6 }}>
        {[
          { icon: "arrow-up" as const, on: () => setDraft(moveWidget(widgets, i, i - 1)), off: i === 0, danger: false },
          { icon: "arrow-down" as const, on: () => setDraft(moveWidget(widgets, i, i + 1)), off: i === widgets.length - 1, danger: false },
          ...(widgetSpec(w.id).sizes.length > 1
            ? [{ icon: (w.size === "l" ? "contract" : "expand") as "contract" | "expand", on: () => setDraft(widgets.map((x, j) => (j === i ? { ...x, size: x.size === "l" ? ("s" as const) : ("l" as const) } : x))), off: false, danger: false }]
            : []),
          { icon: "remove" as const, on: () => setDraft(widgets.filter((_, j) => j !== i)), off: false, danger: true },
        ].map((b, k) => (
          <Pressable key={k} disabled={b.off} onPress={b.on} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: b.danger ? "#EF4444" : "rgba(148,163,184,0.25)", opacity: b.off ? 0.3 : 1 }}>
            <Ionicons name={b.icon} size={16} color="#fff" />
          </Pressable>
        ))}
      </Row>
    </Row>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen columns>
        {isDemoAccount(pilot.email) ? <Txt variant="small" color={c.accent}>{t("access.demoAccount")}</Txt> : null}
        <View style={{ gap: 2, marginTop: 4 }}>
          <Txt variant="muted">{[t(`dash.greet_${dayPart()}` as I18nKey), pilotFirstName(pilot)].filter(Boolean).join(" ")}</Txt>
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
            <Txt variant="h2">{t(hadAccount ? "dash.expiredTitle" : "dash.signInTitle")}</Txt>
            <Txt variant="muted">{t(hadAccount ? "dash.expiredText" : "dash.signInText")}</Txt>
            <Button title={t("dash.signIn")} onPress={() => router.push("/auth")} />
          </Card>
        ) : null}

        <Clocks />
        <Row style={{ justifyContent: "flex-end", marginTop: -6 }}>
          <Pressable onPress={() => (editing ? void save() : setDraft(saved))} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: editing ? c.accent : withAlpha(c.accent, 0.15), borderWidth: 1, borderColor: withAlpha(c.accent, 0.4) }}>
            <Ionicons name={editing ? "checkmark" : "options-outline"} size={15} color={editing ? c.onAccent : c.accent} />
            <Txt style={{ fontWeight: "700", fontSize: 13 }} color={editing ? c.onAccent : c.accent}>{t(editing ? "dash.customDone" : "dash.customize")}</Txt>
          </Pressable>
        </Row>

        {editing
          ? widgets.map((w, i) => (
              <View key={w.id} style={{ gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(74,222,128,0.5)", borderRadius: 22, padding: 6 }}>
                {edit(i, w)}
                <View pointerEvents="none">{block(w) ?? <Card><Txt variant="muted">{t("dash.widgetEmpty")}</Txt></Card>}</View>
              </View>
            ))
          : rows.map((r) =>
              r.length === 2 ? (
                <Row key={r.map((w) => w.id).join("-")} style={{ gap: space.md, alignItems: "stretch" }}>
                  {r.map((w) => <View key={w.id} style={{ flex: 1 }}>{block(w)}</View>)}
                </Row>
              ) : r[0]!.size === "s" ? (
                <Row key={r[0]!.id} style={{ gap: space.md }}>
                  <View style={{ flex: 1 }}>{block(r[0]!)}</View>
                  <View style={{ flex: 1 }} />
                </Row>
              ) : (
                <React.Fragment key={r[0]!.id}>{block(r[0]!)}</React.Fragment>
              ),
            )}

        {editing && hiddenWidgets(widgets).length ? (
          <Card>
            <Txt variant="h2">{t("dash.addWidget")}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {hiddenWidgets(widgets).map((w) => (
                <Pressable key={w.id} onPress={() => setDraft([...widgets, { id: w.id, size: w.sizes[0]! }])} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(148,163,184,0.4)" }}>
                  <Ionicons name="add" size={14} color={c.accent} />
                  <Txt variant="small" style={{ fontWeight: "600" }}>{widgetLabel(w.id, locale)}</Txt>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}
        {editing ? <Button kind="ghost" title={t("dash.customCancel")} onPress={() => setDraft(null)} /> : null}
      </Screen>
    </View>
  );
}

/** The time now in UTC and where the pilot is (the phone's time zone), as on a cockpit clock. */
function Clocks() {
  const { t } = useApp();
  const c = useTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const hm = (tz?: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, ...(tz ? { timeZone: tz } : {}) }).format(now);
  let zone: string | undefined;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    zone = undefined;
  }
  const city = zone?.split("/").pop()?.replace(/_/g, " ");
  const offsetMin = -now.getTimezoneOffset();
  const offset = `UTC${offsetMin >= 0 ? "+" : "−"}${Math.floor(Math.abs(offsetMin) / 60)}${Math.abs(offsetMin) % 60 ? `:${String(Math.abs(offsetMin) % 60).padStart(2, "0")}` : ""}`;
  const box = { flex: 1, flexDirection: "row" as const, alignItems: "baseline" as const, gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", backgroundColor: "rgba(15,23,42,0.55)" };
  return (
    <Row style={{ gap: 8 }}>
      <View style={box}>
        <Txt variant="small" style={{ fontWeight: "700", fontSize: 10.5, letterSpacing: 0.8 }}>UTC</Txt>
        <Txt mono style={{ fontSize: 20, fontWeight: "700" }}>{hm("UTC")}</Txt>
      </View>
      <View style={box}>
        <Txt variant="small" style={{ fontWeight: "700", fontSize: 10.5, letterSpacing: 0.8 }}>{t("dash.localTime")}</Txt>
        <Txt mono style={{ fontSize: 20, fontWeight: "700" }}>{hm()}</Txt>
        <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1 }} color={c.muted}>{city ? `${city} · ${offset}` : offset}</Txt>
      </View>
    </Row>
  );
}
