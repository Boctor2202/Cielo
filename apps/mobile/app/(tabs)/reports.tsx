import React, { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { formatDuration, PILOT_FUNCTIONS, sumFlights, type Flight, type Totals } from "@cielo/core";
import { Button, Card, Chip, EmptyState, Row, Screen, Stat, ToggleRow, Txt } from "../../src/components/ui";
import { BarRow } from "../../src/components/Bars";
import { shareFile } from "../../src/exporters";
import { formatMonth, type I18nKey } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { space } from "../../src/theme";

type Preset = "month" | "m3" | "year" | "lastYear" | "m12" | "all";
type GroupBy = "month" | "year" | "type" | "registration" | "function" | "route" | "airport";
type Condition = "all" | "night" | "ifr" | "pic" | "multiPilot";

const PRESETS: Preset[] = ["month", "m3", "year", "lastYear", "m12", "all"];
const GROUPS: GroupBy[] = ["month", "year", "type", "registration", "function", "route", "airport"];
const CONDITIONS: Condition[] = ["all", "night", "ifr", "pic", "multiPilot"];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function range(p: Preset, today: string): [string, string] {
  const t = new Date(`${today}T12:00:00Z`);
  const y = t.getUTCFullYear();
  switch (p) {
    case "month": return [`${today.slice(0, 7)}-01`, today];
    case "m3": return [iso(new Date(Date.UTC(y, t.getUTCMonth() - 2, 1))), today];
    case "year": return [`${y}-01-01`, today];
    case "lastYear": return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case "m12": return [iso(new Date(t.getTime() - 365 * 86_400_000)), today];
    default: return ["0000-01-01", "9999-12-31"];
  }
}

function keysOf(f: Flight, g: GroupBy): string[] {
  switch (g) {
    case "month": return [f.date.slice(0, 7)];
    case "year": return [f.date.slice(0, 4)];
    case "type": return [f.aircraftTypeIcao || (f.isFstd ? "FSTD" : "—")];
    case "registration": return [f.registration?.toUpperCase() || (f.isFstd ? "FSTD" : "—")];
    case "function": return [f.function];
    case "route": return [f.isFstd ? "FSTD" : `${f.depIcao} → ${f.arrIcao}`];
    case "airport": return f.isFstd ? [] : [...new Set([f.depIcao, f.arrIcao])];
  }
}

/** A horizontally scrolling line of chips, for filters with many values. */
function ChipLine({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs, paddingRight: space.md }}>
      {children}
    </ScrollView>
  );
}

/**
 * Logbook reports, as on the website: pick a period and filters, group the flights, read the totals per
 * group and share them as CSV. Computed on the device from the local logbook.
 */
export default function Reports() {
  const { t, flights, pilot } = useApp();
  const today = todayUtc();
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);
  const [preset, setPreset] = useState<Preset>("year");
  const [type, setType] = useState("");
  const [reg, setReg] = useState("");
  const [fn, setFn] = useState("");
  const [cond, setCond] = useState<Condition>("all");
  const [fstd, setFstd] = useState(true);
  const [group, setGroup] = useState<GroupBy>("month");

  const live = useMemo(() => flights.filter((f) => !f.deletedAt), [flights]);
  const options = useMemo(() => {
    const u = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
    return { types: u(live.map((f) => f.aircraftTypeIcao)), regs: u(live.map((f) => f.registration?.toUpperCase())) };
  }, [live]);

  const [start, end] = range(preset, today);
  const selected = useMemo(
    () =>
      live.filter((f) => {
        if (f.date < start || f.date > end) return false;
        if (!fstd && f.isFstd) return false;
        if (type && f.aircraftTypeIcao !== type) return false;
        if (reg && f.registration?.toUpperCase() !== reg) return false;
        if (fn && f.function !== fn) return false;
        if (cond === "night" && !f.nightMin) return false;
        if (cond === "ifr" && !f.ifrMin) return false;
        if (cond === "pic" && !f.picMin) return false;
        if (cond === "multiPilot" && !f.multiPilotMin) return false;
        return true;
      }),
    [live, start, end, fstd, type, reg, fn, cond],
  );
  const totals = useMemo(() => sumFlights(selected), [selected]);
  const rows = useMemo(() => {
    const m = new Map<string, Flight[]>();
    for (const f of selected) for (const k of keysOf(f, group)) m.set(k, [...(m.get(k) ?? []), f]);
    const list = [...m.entries()].map(([key, fs]) => ({ key, t: sumFlights(fs) }));
    return group === "month" || group === "year"
      ? list.sort((a, b) => b.key.localeCompare(a.key))
      : list.sort((a, b) => b.t.totalMin + b.t.fstdMin - (a.t.totalMin + a.t.fstdMin));
  }, [selected, group]);
  const max = Math.max(1, ...rows.map((r) => r.t.totalMin + r.t.fstdMin));

  const label = (key: string) => (group === "month" && /^\d{4}-\d{2}$/.test(key) ? formatMonth(key, pilot.locale) : key);
  const ldg = (x: Totals) => x.landingsDay + x.landingsNight;
  const filtersOn = !!(type || reg || fn || cond !== "all" || !fstd);
  const reset = () => {
    setType("");
    setReg("");
    setFn("");
    setCond("all");
    setFstd(true);
  };

  const csvCell = (v: string | number) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const h = (m: number) => (m / 60).toFixed(2);
  const [busy, setBusy] = useState(false);
  const exportReport = async () => {
    const head = [t(`logReport.group.${group}` as I18nKey), t("logReport.col.flights"), t("logReport.col.total"), t("logReport.col.pic"), t("logReport.col.copilot"), t("logReport.col.dual"), t("logReport.col.instructor"), t("logReport.col.multiPilot"), t("logReport.col.night"), t("logReport.col.ifr"), t("logReport.col.fstd"), t("logReport.col.landings")];
    const line = (k: string, x: Totals) => [label(k), x.flights + x.fstdSessions, h(x.totalMin), h(x.picMin), h(x.copilotMin), h(x.dualMin), h(x.instructorMin), h(x.multiPilotMin), h(x.nightMin), h(x.ifrMin), h(x.fstdMin), ldg(x)];
    const csv = [head, ...rows.map((r) => line(r.key, r.t)), line(t("logReport.total"), totals)].map((r) => r.map(csvCell).join(";")).join("\r\n");
    setBusy(true);
    try {
      await shareFile(`geardown-report-${preset}-${today}.csv`, "﻿" + csv, "text/csv", "public.comma-separated-values-text");
    } catch (e) {
      Alert.alert(t("logReport.exportFailed"), e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Txt variant="label">{t("logReport.period")}</Txt>
        <ChipLine>
          {PRESETS.map((p) => (
            <Chip key={p} label={t(`logReport.preset.${p}` as I18nKey)} selected={preset === p} onPress={() => setPreset(p)} />
          ))}
        </ChipLine>
        <Txt variant="label">{t("logReport.condition")}</Txt>
        <ChipLine>
          {CONDITIONS.map((x) => (
            <Chip key={x} label={t(`logReport.cond.${x}` as I18nKey)} selected={cond === x} onPress={() => setCond(x)} />
          ))}
        </ChipLine>
        {options.types.length > 1 ? (
          <>
            <Txt variant="label">{t("logReport.type")}</Txt>
            <ChipLine>
              <Chip label={t("logReport.any")} selected={!type} onPress={() => setType("")} />
              {options.types.map((x) => (
                <Chip key={x} label={x} selected={type === x} onPress={() => setType(type === x ? "" : x)} />
              ))}
            </ChipLine>
          </>
        ) : null}
        {options.regs.length > 1 ? (
          <>
            <Txt variant="label">{t("logReport.registration")}</Txt>
            <ChipLine>
              <Chip label={t("logReport.any")} selected={!reg} onPress={() => setReg("")} />
              {options.regs.map((x) => (
                <Chip key={x} label={x} selected={reg === x} onPress={() => setReg(reg === x ? "" : x)} />
              ))}
            </ChipLine>
          </>
        ) : null}
        <Txt variant="label">{t("logReport.function")}</Txt>
        <ChipLine>
          <Chip label={t("logReport.any")} selected={!fn} onPress={() => setFn("")} />
          {PILOT_FUNCTIONS.map((x) => (
            <Chip key={x} label={x} selected={fn === x} onPress={() => setFn(fn === x ? "" : x)} />
          ))}
        </ChipLine>
        <ToggleRow label={t("logReport.includeFstd")} value={fstd} onChange={setFstd} />
        {filtersOn ? <Button kind="ghost" title={t("logReport.reset")} onPress={reset} /> : null}
      </Card>

      <Card>
        <Row gap={space.md}>
          <Stat label={t("logReport.col.total")} value={fmt(totals.totalMin)} sub={t("dash.flights", { n: totals.flights + totals.fstdSessions })} />
          <Stat label={t("logReport.col.pic")} value={fmt(totals.picMin)} />
        </Row>
        <Row gap={space.md}>
          <Stat label={t("logReport.col.night")} value={fmt(totals.nightMin)} />
          <Stat label={t("logReport.col.ifr")} value={fmt(totals.ifrMin)} />
          <Stat label={t("logReport.col.landings")} value={String(ldg(totals))} />
        </Row>
      </Card>

      <Card>
        <Txt variant="label">{t("logReport.groupBy")}</Txt>
        <ChipLine>
          {GROUPS.map((g) => (
            <Chip key={g} label={t(`logReport.group.${g}` as I18nKey)} selected={group === g} onPress={() => setGroup(g)} />
          ))}
        </ChipLine>
        {rows.length === 0 ? (
          <EmptyState title={t("logReport.empty")} />
        ) : (
          <View style={{ gap: space.md }}>
            {rows.map((r) => (
              <BarRow
                key={r.key}
                label={label(r.key)}
                value={fmt(r.t.totalMin + r.t.fstdMin)}
                ratio={(r.t.totalMin + r.t.fstdMin) / max}
                sub={[
                  t("dash.flights", { n: r.t.flights + r.t.fstdSessions }),
                  r.t.picMin ? `${t("logReport.col.pic")} ${fmt(r.t.picMin)}` : "",
                  r.t.nightMin ? `${t("logReport.col.night")} ${fmt(r.t.nightMin)}` : "",
                  r.t.ifrMin ? `${t("logReport.col.ifr")} ${fmt(r.t.ifrMin)}` : "",
                  `${t("logReport.col.landings")} ${ldg(r.t)}`,
                ].filter(Boolean).join(" · ")}
              />
            ))}
          </View>
        )}
        {group === "airport" && rows.length ? <Txt variant="small">{t("logReport.airportNote")}</Txt> : null}
        <Button kind="secondary" title={t("logReport.export")} loading={busy} disabled={!rows.length} onPress={() => void exportReport()} />
      </Card>
      <View style={{ height: space.md }} />
    </Screen>
  );
}
