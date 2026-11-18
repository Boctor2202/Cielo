import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import Storage from "expo-sqlite/kv-store";
import type { Flight, RosterEvent } from "@cielo/core";
import { notificationPermission } from "./notifications";
import type { TFunction } from "./i18n";
import { useApp } from "./state";

/**
 * "Flight over: log it?": a reminder 30 minutes after the end of each rostered flight not yet logged, opening
 * the flight form filled from the roster. Local notifications (the 10 next flights, 14 days ahead); they are
 * re-planned whenever the roster or the logbook changes, so a flight logged early cancels its reminder.
 */
const PREFIX = "log:";
const KEY = "reminders.logFlights";
const AFTER_MIN = 30;

export const logRemindersOn = () => {
  try {
    return Storage.getItemSync(KEY) !== "off";
  } catch {
    return true;
  }
};
export const setLogRemindersOn = (on: boolean) => {
  try {
    Storage.setItemSync(KEY, on ? "on" : "off");
  } catch {
    /* not kept */
  }
};

export async function scheduleLogReminders(events: RosterEvent[], flights: Flight[], t: TFunction): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  // only with the permission the pilot already gave (never asked from here)
  if (!logRemindersOn() || (await notificationPermission()) !== "granted") return;
  const logged = new Set(flights.filter((f) => !f.deletedAt && f.rosterEventId).map((f) => f.rosterEventId!));
  const now = Date.now();
  const plans = events
    .filter((e) => !e.deletedAt && e.kind === "FLIGHT" && !e.flightId && !logged.has(e.id))
    .map((e) => ({ e, at: Date.parse(e.endUtc) + AFTER_MIN * 60_000 }))
    .filter((p) => p.at > now && p.at < now + 14 * 86_400_000)
    .sort((a, b) => a.at - b.at)
    .slice(0, 10);
  for (const { e, at } of plans) {
    const route = [e.depIcao, e.arrIcao].filter(Boolean).join(" → ");
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${e.id}`,
      content: {
        title: t("logRem.title", { flight: [e.flightNumber, route].filter(Boolean).join(" ") || t("logRem.flight") }),
        body: t("logRem.body"),
        data: { kind: "logFlight", rosterEventId: e.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    }).catch(() => undefined);
  }
}

/** Keeps the reminders in step with the roster and the logbook. */
export function LogReminderSync() {
  const { t, rosterEvents, flights } = useApp();
  useEffect(() => {
    const id = setTimeout(() => void scheduleLogReminders(rosterEvents, flights, t).catch(() => undefined), 1500);
    return () => clearTimeout(id);
  }, [rosterEvents, flights, t]);
  return null;
}
