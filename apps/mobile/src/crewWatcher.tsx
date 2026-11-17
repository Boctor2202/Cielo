import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { loadCrew } from "./crew";
import { useApp } from "./state";

/**
 * Looks for new link requests and flights to sign when the app opens or comes back to the foreground (badge in
 * the More menu), and shows a notification when more are waiting than at the last look.
 */
export function CrewInboxWatcher() {
  const { t, session, access } = useApp();
  const token = session?.access_token;
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!token || !access.has("signature")) return;
    const check = async () => {
      try {
        const d = await loadCrew(token);
        const n = d.toSign.length + d.linkRequests.filter((l) => l.status === "pending").length;
        if (last.current !== null && n > last.current) {
          await Notifications.scheduleNotificationAsync({
            content: { title: t("crew.notifTitle"), body: t("crew.notifBody", { n }), data: { route: "/crew" } },
            trigger: null,
          });
        }
        last.current = n;
      } catch {
        /* offline */
      }
    };
    void check();
    const s = AppState.addEventListener("change", (st) => st === "active" && void check());
    const i = setInterval(() => void check(), 10 * 60_000);
    return () => (s.remove(), clearInterval(i));
  }, [token, access, t]);
  return null;
}
