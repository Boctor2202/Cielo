import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Storage from "expo-sqlite/kv-store";
import { DEFAULT_ALERT_DAYS, addDays, isoDate, type License } from "@cielo/core";
import { formatDate, type TFunction } from "./i18n";
import type { Locale } from "@cielo/core";

const PREFIX = "lic:";
const CHANNEL = "documents";
/** iOS keeps at most 64 pending local notifications per app. */
const MAX_PENDING = 50;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Reminder preferences, kept on this device only. */
export interface ReminderPrefs {
  enabled: boolean;
  /** local hour the reminders arrive at */
  hour: number;
}
const PREFS_KEY = "reminders.prefs";
export const DEFAULT_REMINDER_PREFS: ReminderPrefs = { enabled: true, hour: 9 };

export async function loadReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await Storage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_REMINDER_PREFS, ...(JSON.parse(raw) as Partial<ReminderPrefs>) } : DEFAULT_REMINDER_PREFS;
  } catch {
    return DEFAULT_REMINDER_PREFS;
  }
}
export async function saveReminderPrefs(p: ReminderPrefs): Promise<void> {
  await Storage.setItem(PREFS_KEY, JSON.stringify(p)).catch(() => undefined);
}

export async function notificationPermission(): Promise<"granted" | "denied" | "undetermined"> {
  const p = await Notifications.getPermissionsAsync().catch(() => null);
  if (!p) return "undetermined";
  if (p.granted) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}

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
 * (Re)schedules one local notification per document and alert threshold (default 90/30/7 days, plus
 * the expiry day), at the chosen local hour. Thresholds come from the document's alertDays.
 * `ask`: whether the permission prompt may be shown (not at launch, only after a user action).
 */
export async function scheduleLicenseAlerts(licenses: License[], t: TFunction, locale: Locale, ask = true): Promise<boolean> {
  const prefs = await loadReminderPrefs();
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!prefs.enabled) return false;
  const granted = ask ? await ensureNotificationPermission().catch(() => false) : (await notificationPermission()) === "granted";
  if (!granted) return false;

  const now = Date.now();
  const today = isoDate(now);
  const plans: { licenseId: string; id: string; at: Date; title: string; body: string }[] = [];
  for (const l of licenses) {
    if (l.deletedAt || !l.validUntil || l.validUntil < today) continue;
    const thresholds = new Set([...(l.alertDays?.length ? l.alertDays : DEFAULT_ALERT_DAYS), 0]);
    for (const d of thresholds) {
      const day = addDays(l.validUntil, -d);
      const [y, m, dd] = day.split("-").map(Number) as [number, number, number];
      const at = new Date(y, m - 1, dd, prefs.hour, 0, 0);
      if (at.getTime() <= now) continue;
      plans.push({
        licenseId: l.id,
        id: `${PREFIX}${l.id}:${d}`,
        at,
        title: d === 0 ? t("docs.notifTitleToday", { code: docName(l, t) }) : t("docs.notifTitle", { code: docName(l, t), n: d }),
        body: t("docs.notifBody", { date: formatDate(l.validUntil, locale) }),
      });
    }
  }
  plans.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const p of plans.slice(0, MAX_PENDING)) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body, data: { kind: "license", licenseId: p.licenseId, at: p.at.toISOString() } },
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

/** "Medical CLASS1", "Rating TR A320"…: the kind in words, then the code the pilot typed. */
export function docName(l: Pick<License, "kind" | "code">, t: TFunction): string {
  const kind = t(`docs.kind.${l.kind}` as Parameters<TFunction>[0]);
  return l.code ? `${kind} ${l.code}` : kind;
}

/** The reminders still to come, soonest first. */
export async function upcomingLicenseAlerts(): Promise<{ id: string; licenseId?: string; title: string; at: Date }[]> {
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  return pending
    .filter((n) => n.identifier.startsWith(PREFIX))
    .map((n) => {
      // the planned time travels in the payload: the trigger's shape differs between iOS and Android
      const data = (n.content.data ?? {}) as { licenseId?: string; at?: string };
      const tr = n.trigger as { value?: number; date?: number | string } | null;
      const at = new Date(data.at ?? tr?.value ?? tr?.date ?? 0);
      return { id: n.identifier, licenseId: data.licenseId, title: n.content.title ?? "", at };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** A sample reminder a few seconds from now, to check notifications reach the phone. */
export async function sendTestReminder(title: string, body: string): Promise<boolean> {
  if (!(await ensureNotificationPermission().catch(() => false))) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { kind: "test" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
  return true;
}
