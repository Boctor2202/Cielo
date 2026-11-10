import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { DEFAULT_ALERT_DAYS, addDays, isoDate, type License } from "@cielo/core";
import { formatDate, type TFunction } from "./i18n";
import type { Locale } from "@cielo/core";

const PREFIX = "lic:";
const CHANNEL = "documents";
/** iOS keeps at most 64 pending local notifications per app. */
const MAX_PENDING = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Documents",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * (Re)schedules one local notification per licence and alert threshold (default 90/30/7 days, plus
 * the expiry day), at 09:00 local time. Thresholds come from the licence's alertDays (see licenseStatus).
 */
export async function scheduleLicenseAlerts(licenses: License[], t: TFunction, locale: Locale): Promise<boolean> {
  const granted = await ensureNotificationPermission().catch(() => false);
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!granted) return false;

  const now = Date.now();
  const today = isoDate(now);
  const plans: { id: string; at: Date; title: string; body: string }[] = [];
  for (const l of licenses) {
    if (l.deletedAt || !l.validUntil || l.validUntil < today) continue;
    const thresholds = new Set([...(l.alertDays?.length ? l.alertDays : DEFAULT_ALERT_DAYS), 0]);
    for (const d of thresholds) {
      const day = addDays(l.validUntil, -d);
      const [y, m, dd] = day.split("-").map(Number) as [number, number, number];
      const at = new Date(y, m - 1, dd, 9, 0, 0);
      if (at.getTime() <= now) continue;
      plans.push({
        id: `${PREFIX}${l.id}:${d}`,
        at,
        title: d === 0 ? t("docs.notifTitleToday", { code: l.code }) : t("docs.notifTitle", { code: l.code, n: d }),
        body: t("docs.notifBody", { date: formatDate(l.validUntil, locale) }),
      });
    }
  }
  plans.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const p of plans.slice(0, MAX_PENDING)) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body, data: { kind: "license" } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: CHANNEL },
    });
  }
  return true;
}

export async function cancelAllLicenseAlerts(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
