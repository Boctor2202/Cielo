import React, { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatClock, formatDuration, minutesBetween } from "@cielo/core";
import { Button, Card, EmptyState, Row, Screen, Txt, tap } from "../../src/components/ui";
import { formatDate } from "../../src/i18n";
import { dismissDraft, draftAircraft, draftToFlight, loadDismissed, pendingDrafts } from "../../src/flightDrafts";
import { useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

/**
 * "Flights to confirm": the roster's flights that ended and are not logged yet, already filled in. One tap
 * logs a flight with its scheduled times; "Edit" opens the full form first; "Ignore" hides it on this phone.
 */
export default function Drafts() {
  const { t, locale, rosterEvents, flights, pilot, aircraft, aircraftTypes, put, access } = useApp();
  const c = useTheme();
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [busy, setBusy] = useState<string | null>(null);
  const drafts = useMemo(() => pendingDrafts(rosterEvents, flights, dismissed), [rosterEvents, flights, dismissed]);
  const lastPf = () => flights.find((f) => !f.deletedAt && !f.isFstd)?.pilotFlying;

  const confirmOne = async (id: string, lastPilotFlying?: boolean) => {
    const e = rosterEvents.find((x) => x.id === id);
    if (!e) return undefined;
    const saved = await put("flights", draftToFlight(e, { pilot, aircraft, aircraftTypes, lastPilotFlying }));
    await put("roster_events", { ...e, flightId: saved.id });
    return saved;
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    if (!access.canWrite) return router.navigate("/subscription");
    setBusy(key);
    try {
      await fn();
      tap("success");
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error && err.message === "read_only" ? t("access.readOnlyBanner") : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const confirmAll = () =>
    Alert.alert(t("drafts.confirmAllTitle", { n: drafts.length }), t("drafts.confirmAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("drafts.confirmAll", { n: drafts.length }),
        onPress: () =>
          void run("all", async () => {
            // oldest first, so "alternate" pilot flying follows the order the legs were flown
            let pf = lastPf();
            for (const d of drafts) {
              const saved = await confirmOne(d.id, pf);
              pf = saved?.pilotFlying ?? pf;
            }
          }),
      },
    ]);

  const ignore = (id: string) => {
    dismissDraft(id);
    setDismissed(loadDismissed());
  };

  return (
    <Screen>
      {drafts.length === 0 ? (
        <EmptyState title={t("drafts.empty")} hint={t("drafts.emptyHint")} />
      ) : (
        <>
          <Card>
            <Row gap={space.sm} style={{ alignItems: "center" }}>
              <Ionicons name="sparkles-outline" size={18} color={c.accent} />
              <Txt style={{ flex: 1 }}>{t("drafts.intro", { n: drafts.length })}</Txt>
            </Row>
            {drafts.length > 1 ? (
              <Button title={t("drafts.confirmAll", { n: drafts.length })} loading={busy === "all"} disabled={!!busy} onPress={confirmAll} />
            ) : null}
          </Card>
          {drafts.map((e) => {
            const { ac, type } = draftAircraft(e, { aircraft, aircraftTypes });
            const block = minutesBetween(e.startUtc, e.endUtc);
            return (
              <Card key={e.id}>
                <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                  <Txt style={{ fontSize: 18, fontWeight: "700", letterSpacing: 0.3 }}>{`${e.depIcao}  →  ${e.arrIcao}`}</Txt>
                  <Txt mono style={{ fontWeight: "700" }} color={c.accent}>
                    {formatDuration(block, pilot.timeDisplay)}
                  </Txt>
                </Row>
                <Txt variant="small">
                  {formatDate(e.startUtc.slice(0, 10), locale)} · {formatClock(e.startUtc)}–{formatClock(e.endUtc)} UTC
                  {e.flightNumber ? ` · ${e.flightNumber}` : ""}
                </Txt>
                <Txt variant="small">
                  {[ac?.registration ?? e.aircraftReg, type ? `${type.icao}` : e.aircraftTypeIcao, pilot.defaultFunction].filter(Boolean).join(" · ") || t("drafts.noAircraft")}
                </Txt>
                <Txt variant="small" color={c.muted}>{t("drafts.scheduledNote")}</Txt>
                <Row gap={space.sm}>
                  <Button style={{ flex: 1 }} small title={t("drafts.confirm")} loading={busy === e.id} disabled={!!busy} onPress={() => void run(e.id, async () => void (await confirmOne(e.id, lastPf())))} />
                  <Button
                    style={{ flex: 1 }}
                    small
                    kind="secondary"
                    title={t("drafts.edit")}
                    disabled={!!busy}
                    onPress={() => router.push({ pathname: "/flight/[id]", params: { id: "new", rosterEventId: e.id } })}
                  />
                </Row>
                <Button small kind="ghost" title={t("drafts.ignore")} disabled={!!busy} onPress={() => ignore(e.id)} />
              </Card>
            );
          })}
        </>
      )}
      <View style={{ height: space.md }} />
    </Screen>
  );
}
