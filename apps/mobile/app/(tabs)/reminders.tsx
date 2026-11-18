import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { licenseStatus } from "@cielo/core";
import { Badge, Button, Card, Chip, EmptyState, Row, Screen, ToggleRow, Txt, statusColor } from "../../src/components/ui";
import { formatDate } from "../../src/i18n";
import {
  DEFAULT_REMINDER_PREFS,
  docName,
  loadReminderPrefs,
  notificationPermission,
  saveReminderPrefs,
  scheduleLicenseAlerts,
  sendTestReminder,
  upcomingLicenseAlerts,
  type ReminderPrefs,
} from "../../src/notifications";
import { statusLabel } from "../../src/licenseLabel";
import { logRemindersOn, scheduleLogReminders, setLogRemindersOn } from "../../src/logReminders";
import { todayUtc, useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

const HOURS = [7, 8, 9, 12, 18];

/**
 * Expiry reminders: on/off, the hour they arrive, whether the phone lets them through, the documents
 * followed and the next reminders planned on this phone.
 */
export default function Reminders() {
  const { t, licenses, locale, rosterEvents, flights } = useApp();
  const [logOn, setLogOn] = useState(logRemindersOn);
  const c = useTheme();
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_REMINDER_PREFS);
  const [perm, setPerm] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [upcoming, setUpcoming] = useState<Awaited<ReturnType<typeof upcomingLicenseAlerts>>>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setPrefs(await loadReminderPrefs());
    setPerm(await notificationPermission());
    setUpcoming(await upcomingLicenseAlerts());
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    void refresh();
  }, [licenses, refresh]);

  const apply = async (next: ReminderPrefs) => {
    setPrefs(next);
    setBusy(true);
    await saveReminderPrefs(next);
    await scheduleLicenseAlerts(licenses, t, locale, next.enabled).catch(() => undefined);
    await refresh();
    setBusy(false);
  };

  const today = todayUtc();
  const followed = licenses
    .filter((l) => !l.deletedAt && l.validUntil)
    .map((l) => ({ l, s: licenseStatus(l, today) }))
    .sort((a, b) => (a.l.validUntil ?? "").localeCompare(b.l.validUntil ?? ""));

  const test = async () => {
    const ok = await sendTestReminder(t("rem.testTitle"), t("rem.testBody"));
    await refresh();
    Alert.alert(ok ? t("rem.testSent") : t("docs.notifDenied"));
  };

  const fmtWhen = (d: Date) =>
    `${formatDate(d.toISOString().slice(0, 10), locale)} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <Screen>
      <Card>
        <ToggleRow label={t("rem.enabled")} hint={t("rem.enabledHint")} value={prefs.enabled} onChange={(v) => void apply({ ...prefs, enabled: v })} />
        <ToggleRow
          label={t("logRem.toggle")}
          hint={t("logRem.hint")}
          value={logOn}
          onChange={(v) => {
            setLogOn(v);
            setLogRemindersOn(v);
            void scheduleLogReminders(rosterEvents, flights, t);
          }}
        />
        {prefs.enabled ? (
          <>
            <Txt variant="label">{t("rem.hour")}</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
              {HOURS.map((h) => (
                <Chip key={h} label={`${String(h).padStart(2, "0")}:00`} selected={prefs.hour === h} onPress={() => void apply({ ...prefs, hour: h })} />
              ))}
            </ScrollView>
            <Txt variant="small">{t("rem.delaysHint")}</Txt>
          </>
        ) : null}
        {prefs.enabled && perm === "denied" ? (
          <View style={{ gap: space.sm }}>
            <Txt color={c.warning}>{t("rem.blocked")}</Txt>
            <Button kind="secondary" title={t("rem.openSettings")} onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
        {prefs.enabled ? <Button kind="ghost" title={t("rem.test")} loading={busy} onPress={() => void test()} /> : null}
      </Card>

      <Card>
        <Txt variant="h2">{t("rem.followed")}</Txt>
        {followed.length === 0 ? (
          <EmptyState title={t("rem.noDocs")} action={<Button kind="secondary" title={t("docs.new")} onPress={() => router.push({ pathname: "/document/[id]", params: { id: "new" } })} />} />
        ) : (
          followed.map(({ l, s }) => (
            <Pressable key={l.id} onPress={() => router.push({ pathname: "/document/[id]", params: { id: l.id } })}>
              <Row style={{ justifyContent: "space-between", alignItems: "center", paddingVertical: space.xs }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt numberOfLines={1}>{docName(l, t)}</Txt>
                  <Txt variant="small">
                    {t("rem.validUntil", { date: formatDate(l.validUntil!, locale) })} · {t("rem.alerts", { days: (l.alertDays?.length ? l.alertDays : [90, 30, 7]).join(", ") })}
                  </Txt>
                </View>
                <Badge text={statusLabel(t, s)} color={statusColor(c, s.state)} />
              </Row>
            </Pressable>
          ))
        )}
      </Card>

      {prefs.enabled ? (
        <Card>
          <Txt variant="h2">{t("rem.upcoming")}</Txt>
          {upcoming.length === 0 ? (
            <Txt variant="small">{perm === "granted" ? t("rem.none") : t("rem.noneNoPermission")}</Txt>
          ) : (
            upcoming.slice(0, 12).map((u) => (
              <View key={u.id} style={{ gap: 2, paddingVertical: space.xs }}>
                <Txt numberOfLines={1}>{u.title}</Txt>
                <Txt variant="small" mono>{fmtWhen(u.at)}</Txt>
              </View>
            ))
          )}
          {upcoming.length > 12 ? <Txt variant="small">{t("rem.more", { n: upcoming.length - 12 })}</Txt> : null}
        </Card>
      ) : null}
      <View style={{ height: space.md }} />
    </Screen>
  );
}
