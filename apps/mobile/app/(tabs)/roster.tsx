import React, { useMemo, useState } from "react";
import { Alert, Pressable, SectionList, View } from "react-native";
import { router } from "expo-router";
import { formatClock, formatDuration, minutesBetween } from "@cielo/core";
import { useWide, Button, EmptyState, Fab, Glass, Row, Segmented, Txt } from "../../src/components/ui";
import { type I18nKey } from "../../src/i18n";
import { useApp } from "../../src/state";
import { RosterPdfError, pickAndImportRoster } from "../../src/rosterImport";
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
  const { t, locale, rosterEvents, access, store, pilot, reload, session } = useApp();
  const wide = useWide();
  const c = useTheme();
  const [importing, setImporting] = useState(false);
  // upcoming duties by default; "past" shows the last 90 days, newest first, so earlier events can be corrected
  const [when, setWhen] = useState<"next" | "past">("next");

  // read-only without a live subscription: the roster stays visible, adding / importing opens the plans
  const addEvent = () => (access.canWrite ? router.push({ pathname: "/roster/[id]", params: { id: "new" } }) : router.push("/subscription"));
  const importRoster = async () => {
    if (!access.canWrite) return router.push("/subscription");
    setImporting(true);
    try {
      // all events, past ones included, so a re-import recognises what is already there
      const all = await store.all("roster_events");
      const r = await pickAndImportRoster(store, pilot, all, session?.access_token);
      if (!r) return;
      await reload();
      Alert.alert(
        t("roster.import"),
        r.imported || r.updated || r.duplicates ? t("roster.importDone", { n: r.imported, u: r.updated, d: r.duplicates, s: r.skipped }) : t("roster.importEmpty"),
      );
    } catch (e) {
      const code = e instanceof RosterPdfError ? e.message : null;
      const known = ["signin", "plan", "too_big", "not_configured", "rate_limited", "unreadable", "too_long", "unsupported"];
      Alert.alert(t("roster.importFailed"), code ? t(`roster.pdfErr.${known.includes(code) ? code : "other"}` as I18nKey) : e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };
  const days = useMemo(() => {
    const now = new Date().toISOString();
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const by = new Map<string, typeof rosterEvents>();
    const list =
      when === "next"
        ? rosterEvents.filter((x) => !x.deletedAt && x.endUtc >= now).sort((x, y) => x.startUtc.localeCompare(y.startUtc))
        : rosterEvents.filter((x) => !x.deletedAt && x.endUtc < now && x.startUtc >= from).sort((x, y) => y.startUtc.localeCompare(x.startUtc));
    for (const e of list) {
      const k = e.startUtc.slice(0, 10);
      by.set(k, [...(by.get(k) ?? []), e]);
    }
    return [...by.entries()].map(([day, data]) => ({ day, data }));
  }, [rosterEvents, when]);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const dayTitle = (d: string) =>
    d === today ? t("common.today") : d === tomorrow ? t("roster.tomorrow") : new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const kindColor = (k: string) => (k === "FLIGHT" ? c.accent : k === "DEADHEAD" ? "#64D2FF" : k === "SIM" ? "#BF5AF2" : k === "STANDBY" ? c.caution : k === "OFF" || k === "REST" || k === "LEAVE" ? c.muted : "#0A84FF");

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <SectionList
        style={{ flex: 1, backgroundColor: "transparent" }}
        sections={days}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[{ padding: space.lg, paddingBottom: 140, flexGrow: 1 }, wide ? { width: "100%", maxWidth: 760, alignSelf: "center" } : null]}
        ListHeaderComponent={
          <View style={{ gap: 4 }}>
            <Segmented<"next" | "past">
              value={when}
              onChange={setWhen}
              options={[
                { value: "next", label: t("roster.upcoming") },
                { value: "past", label: t("roster.past") },
              ]}
            />
            <Button kind="secondary" small title={t("roster.import")} loading={importing} onPress={() => void importRoster()} />
            <Txt variant="small" style={{ textAlign: "center" }}>{t("roster.importHint")}</Txt>
          </View>
        }
        ListEmptyComponent={when === "next" ? <EmptyState title={t("roster.empty")} hint={t("roster.emptyHintMobile")} /> : <EmptyState title={t("roster.pastEmpty")} />}
        renderSectionHeader={({ section }) => (
          <Txt style={{ fontSize: 20, fontWeight: "700", marginTop: space.lg, marginBottom: space.sm, textTransform: "capitalize" }}>{dayTitle(section.day)}</Txt>
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item: e }) => {
          const color = kindColor(e.kind);
          const rest = e.kind === "OFF" || e.kind === "REST" || e.kind === "LEAVE";
          // events typed on the phone or the web (no roster file behind them) can be edited and deleted
          const manual = !e.rosterId;
          return (
            <Pressable disabled={!manual || !access.canWrite} onPress={() => router.push({ pathname: "/roster/[id]", params: { id: e.id } })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
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
              </Pressable>
          );
        }}
      />
    <Fab label={t("roster.addEvent")} onPress={addEvent} />
    </View>
  );
}
