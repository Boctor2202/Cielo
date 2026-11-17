import * as Notifications from "expo-notifications";
import { addDays, computeCurrency, currencyAlerts, licenseStatus, type AircraftType, type CurrencyItem, type Flight, type License, type Pilot } from "@cielo/core";
import { loadReminderPrefs, notificationPermission } from "./notifications";
import { formatDate, type TFunction } from "./i18n";

/** A valid instrument rating waives the EASA/CASA night requirement. */
export function holdsValidIr(licenses: License[], today: string): boolean {
  return licenses.some((l) => !l.deletedAt && /^(IR|EIR|CB-IR|BIR)\b/i.test(l.code.trim()) && licenseStatus(l, today).state !== "expired");
}

export function currencyFor(flights: Flight[], types: AircraftType[], licenses: License[], pilot: Pilot, today = new Date().toISOString().slice(0, 10)): CurrencyItem[] {
  return computeCurrency(flights, today, { framework: pilot.regulatoryFramework, types, holdsIr: holdsValidIr(licenses, today) });
}

const PREFIX = "cur:";

/**
 * Local notifications before a currency lapses: 14 and 3 days before, and on the last day, at the reminder
 * hour chosen for documents. Re-armed whenever the logbook changes (a new landing pushes the date back).
 */
export async function scheduleCurrencyAlerts(items: CurrencyItem[], t: TFunction, locale: Pilot["locale"]): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const prefs = await loadReminderPrefs();
  if (!prefs.enabled || (await notificationPermission()) !== "granted") return;
  const now = Date.now();
  let planned = 0;
  for (const i of items) {
    if (!i.valid || !i.validUntil) continue;
    for (const d of [14, 3, 0]) {
      const day = addDays(i.validUntil, -d);
      const [y, m, dd] = day.split("-").map(Number) as [number, number, number];
      const at = new Date(y, m - 1, dd, prefs.hour, 0, 0);
      if (at.getTime() <= now || planned >= 20) continue;
      planned++;
      const what = t(`cur.kind.${i.kind}` as Parameters<TFunction>[0]);
      const group = i.group === "all" ? "" : ` ${i.group}`;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${i.key}:${d}`,
        content: {
          title: d === 0 ? t("cur.notifToday", { what, group }) : t("cur.notifTitle", { what, group, n: d }),
          body: t("cur.notifBody", { date: formatDate(i.validUntil, locale) }),
          data: { kind: "currency", at: at.toISOString() },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: "documents" },
      });
    }
  }
}
