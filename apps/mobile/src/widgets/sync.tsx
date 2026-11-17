import { useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";
import Storage from "expo-sqlite/kv-store";
import { analyseFtl, dashboardPeriods, dutyPeriodsFromRoster, formatDuration, type RosterEvent } from "@cielo/core";
import { useCurrency } from "../currency";
import { useFtlSettings } from "../ftlSettings";
import { todayUtc, useApp } from "../state";
import type { SummaryProps } from "./Summary";
import type { DutyProps } from "./DutyActivity";

/**
 * Keeps the home screen widget and the "flight day" Live Activity in step with the logbook and the roster.
 * Runs only on iOS builds that carry the widget extension: the native module is loaded lazily and any failure
 * (older build, Live Activities turned off by the pilot) is ignored.
 */
type Native = { Summary: typeof import("./Summary").default; Duty: typeof import("./DutyActivity").default };
let native: Native | null | undefined;
function load(): Native | null {
  if (native !== undefined) return native;
  try {
    native = Platform.OS === "ios" ? { Summary: require("./Summary").default, Duty: require("./DutyActivity").default } : null;
  } catch {
    native = null;
  }
  return native;
}

const LIVE_KEY = "liveActivity";
export const liveActivityEnabled = () => {
  try {
    return Storage.getItemSync(LIVE_KEY) !== "off";
  } catch {
    return true;
  }
};
export const setLiveActivityEnabled = (on: boolean) => {
  try {
    Storage.setItemSync(LIVE_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (!on) void endAll();
};
async function endAll() {
  const n = load();
  if (!n) return;
  try {
    for (const a of n.Duty.getInstances()) await a.end("immediate");
  } catch {
    /* ignore */
  }
}

const DUTY_KINDS = new Set(["FLIGHT", "DEADHEAD", "SIM", "GROUND", "STANDBY"]);
const legLabel = (e: RosterEvent) =>
  e.kind === "FLIGHT" || e.kind === "DEADHEAD"
    ? [e.flightNumber, e.depIcao && e.arrIcao ? `${e.depIcao} → ${e.arrIcao}` : ""].filter(Boolean).join(" ")
    : e.title || e.kind;

export function WidgetSync() {
  const { t, flights, balances, licenses, rosterEvents, pilot } = useApp();
  const { items } = useCurrency();
  const { settings } = useFtlSettings();
  const today = todayUtc();
  // re-evaluated when the app comes back to the foreground (a duty may have started meanwhile)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const s = AppState.addEventListener("change", (st) => st === "active" && setTick((x) => x + 1));
    const i = setInterval(() => setTick((x) => x + 1), 5 * 60_000);
    return () => (s.remove(), clearInterval(i));
  }, []);

  const summary = useMemo<SummaryProps>(() => {
    const now = Date.now();
    const p = dashboardPeriods(flights, balances, today);
    const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);
    const next = rosterEvents.find((e) => !e.deletedAt && DUTY_KINDS.has(e.kind) && Date.parse(e.reportUtc ?? e.startUtc) > now);
    // the nearest deadline: a document's validity or a recency
    const days = (iso: string) => Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000);
    const dues = [
      ...licenses.filter((l) => !l.deletedAt && l.validUntil).map((l) => ({ label: l.code, d: days(l.validUntil!) })),
      ...items.filter((i) => i.validUntil).map((i) => ({ label: `${t(`cur.kind.${i.kind}` as never)} ${i.group === "all" ? "" : i.group}`.trim(), d: days(i.validUntil!) })),
    ].sort((a, b) => a.d - b.d);
    const due = dues.find((x) => x.d >= -30);
    return {
      h90: fmt(p.d90.totalMin),
      h28: fmt(p.d28.totalMin),
      m12: fmt(p.m12.totalMin),
      l: { d90: t("widget.d90"), d28: t("widget.d28"), m12: t("widget.m12"), next: t("widget.next"), due: t("widget.due"), none: t("widget.none") },
      next: next ? { label: legLabel(next), at: Date.parse(next.reportUtc ?? next.startUtc) } : undefined,
      due: due
        ? { label: due.label, when: due.d < 0 ? t("widget.late", { n: -due.d }) : due.d === 0 ? t("widget.today") : t("widget.in", { n: due.d }), level: due.d < 0 ? "late" : due.d <= 30 ? "soon" : "ok" }
        : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights, balances, licenses, rosterEvents, items, pilot.timeDisplay, today, t, tick]);

  useEffect(() => {
    const n = load();
    if (!n) return;
    try {
      n.Summary.updateSnapshot(summary);
    } catch {
      /* ignore */
    }
  }, [summary]);

  // the Live Activity: from 1 h before report to release of today's rostered duty
  useEffect(() => {
    const n = load();
    if (!n) return;
    void (async () => {
      try {
        const now = Date.now();
        const active = n.Duty.getInstances();
        const report = analyseFtl(dutyPeriodsFromRoster(rosterEvents, settings), new Date(now).toISOString(), settings);
        const cur = report.duties.find((a) => Date.parse(a.duty.reportUtc) - 3_600_000 <= now && now <= Date.parse(a.duty.releaseUtc));
        if (!cur || !liveActivityEnabled()) {
          for (const a of active) await a.end("default");
          return;
        }
        const reportAt = Date.parse(cur.duty.reportUtc);
        const legs = rosterEvents.filter(
          (e) => !e.deletedAt && DUTY_KINDS.has(e.kind) && Date.parse(e.startUtc) >= reportAt && Date.parse(e.endUtc) <= Date.parse(cur.duty.releaseUtc),
        );
        const leg = legs.find((e) => Date.parse(e.endUtc) > now) ?? legs[legs.length - 1];
        const props: DutyProps = {
          leg: leg ? legLabel(leg) : t("widget.duty"),
          std: leg ? Date.parse(leg.startUtc) : undefined,
          reportAt,
          fdpEnd: reportAt + cur.maxFdpMin * 60_000,
          releaseAt: Date.parse(cur.duty.releaseUtc),
          sectors: cur.duty.sectors,
          l: { fdpLeft: t("widget.fdpLeft"), next: t("widget.leg"), report: t("widget.report"), sectors: t("widget.sectors", { n: cur.duty.sectors }), done: t("widget.dutyDone") },
        };
        const stale = new Date(props.releaseAt);
        if (active.length) {
          await active[0]!.update(props, stale);
          for (const a of active.slice(1)) await a.end("immediate");
        } else {
          n.Duty.start(props, "geardown://roster", stale);
        }
      } catch {
        /* Live Activities refused or unavailable */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterEvents, settings, tick, t]);

  return null;
}
