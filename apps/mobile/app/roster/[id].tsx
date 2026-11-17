import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { ROSTER_KINDS, combineUtc, formatClock, formatDuration, minutesBetween, parseClock, type RosterEvent, type RosterEventKind } from "@cielo/core";
import { Button, Card, Chip, Field, Row, Screen, Txt } from "../../src/components/ui";
import { AirportField } from "../../src/components/AirportField";
import { ClockField, normClock } from "../../src/components/ClockField";
import { DateField, isValidDate } from "../../src/components/DateField";
import { Paywall } from "../../src/components/Access";
import type { I18nKey } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

/** kinds that usually cover the whole day: start / end may stay empty (00:00 – 23:59) */
const ALL_DAY: RosterEventKind[] = ["OFF", "REST", "LEAVE"];
/** kinds with a sector: flight number, DEP and ARR */
const SECTOR: RosterEventKind[] = ["FLIGHT", "DEADHEAD"];

export default function RosterEventRoute() {
  const { access } = useApp();
  // read-only without a live subscription: the roster list stays visible, editing does not
  if (!access.canWrite) return <Paywall />;
  return <RosterEventForm />;
}

function RosterEventForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, pilot, rosterEvents, put, remove } = useApp();
  const c = useTheme();
  const existing = id && id !== "new" ? rosterEvents.find((e) => e.id === id) : undefined;

  const [kind, setKind] = useState<RosterEventKind>(existing?.kind ?? "FLIGHT");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(existing?.startUtc.slice(0, 10) ?? todayUtc());
  const [report, setReport] = useState(formatClock(existing?.reportUtc));
  const [start, setStart] = useState(formatClock(existing?.startUtc));
  const [end, setEnd] = useState(formatClock(existing?.endUtc));
  const [flightNumber, setFlightNumber] = useState(existing?.flightNumber ?? "");
  const [dep, setDep] = useState(existing?.depIcao ?? "");
  const [arr, setArr] = useState(existing?.arrIcao ?? "");
  const [error, setError] = useState(false);

  const allDay = ALL_DAY.includes(kind);
  const sector = SECTOR.includes(kind);

  /** UTC instants from the date and the clocks; end before start means the duty ends the next day. */
  const times = () => {
    if (!isValidDate(date)) return null;
    const s = normClock(start) || (allDay ? "00:00" : "");
    const e = normClock(end) || (allDay ? "23:59" : "");
    const r = normClock(report);
    if (!parseClock(s) || !parseClock(e) || (r && !parseClock(r))) return null;
    const startUtc = combineUtc(date, s)!;
    const endUtc = combineUtc(date, e, startUtc)!;
    let reportUtc: string | null = r ? combineUtc(date, r) : null;
    // a report after the start time is the evening before (report 23:30, off-blocks 00:15)
    if (reportUtc && reportUtc > startUtc) reportUtc = new Date(Date.parse(reportUtc) - 86_400_000).toISOString();
    return { startUtc, endUtc, reportUtc };
  };
  const preview = times();
  const nextDay = !!preview && preview.endUtc.slice(0, 10) !== date;

  const save = async () => {
    const tm = times();
    if (!tm) return setError(true);
    const row: Partial<RosterEvent> = {
      ...existing,
      pilotId: pilot.id,
      rosterId: existing?.rosterId ?? null,
      kind,
      title: title.trim() || undefined,
      startUtc: tm.startUtc,
      endUtc: tm.endUtc,
      reportUtc: tm.reportUtc,
      flightNumber: sector ? flightNumber.trim().toUpperCase() || undefined : undefined,
      depIcao: sector ? dep.trim().toUpperCase() || undefined : undefined,
      arrIcao: sector ? arr.trim().toUpperCase() || undefined : undefined,
      flightId: existing?.flightId ?? null,
    };
    await put("roster_events", row);
    router.back();
  };

  const del = () =>
    existing &&
    Alert.alert(t("roster.deleteTitle"), existing.title ?? t(`roster.kind.${existing.kind}` as I18nKey), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await remove("roster_events", existing.id);
          router.back();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          title: existing ? t("roster.editEvent") : t("roster.addEvent"),
          headerRight: () => <Button kind="ghost" small title={t("common.save")} onPress={save} />,
        }}
      />
      <Screen backdrop>
        <Card>
          <Txt variant="label">{t("roster.kind")}</Txt>
          <Row style={{ flexWrap: "wrap" }}>
            {ROSTER_KINDS.map((k) => (
              <Chip key={k} label={t(`roster.kind.${k}` as I18nKey)} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </Row>
          <Field label={`${t("roster.eventTitle")} (${t("common.optional")})`} value={title} onChangeText={setTitle} placeholder={t(`roster.kind.${kind}` as I18nKey)} />
        </Card>

        <Card>
          <DateField label={t("roster.date")} value={date} onChange={setDate} quick={["today"]} required />
          <Txt variant="small">{allDay ? t("roster.allDayHint") : t("roster.clocksHint")}</Txt>
          <Row gap={space.sm} style={{ alignItems: "flex-start" }}>
            <ClockField label={t("roster.report")} value={report} onChange={setReport} now={false} />
            <ClockField label={t("roster.start")} value={start} onChange={setStart} now={false} required={!allDay && error} />
            <ClockField label={t("roster.end")} value={end} onChange={setEnd} now={false} required={!allDay && error} />
          </Row>
          {preview ? (
            <Txt variant="small" mono>
              {formatDuration(minutesBetween(preview.startUtc, preview.endUtc))} · UTC{nextDay ? ` · ${t("roster.nextDay")}` : ""}
            </Txt>
          ) : null}
        </Card>

        {sector ? (
          <Card>
            <Field
              label={t("roster.flightNumber")}
              value={flightNumber}
              onChangeText={(s) => setFlightNumber(s.toUpperCase())}
              monoValue
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="AF1234"
            />
            <Row gap={space.sm} style={{ alignItems: "flex-start" }}>
              <AirportField label={t("roster.dep")} value={dep} onChange={setDep} />
              <AirportField label={t("roster.arr")} value={arr} onChange={setArr} />
            </Row>
          </Card>
        ) : null}

        {error ? <Txt color={c.warning}>{t("roster.invalid")}</Txt> : null}
        <Button title={t("common.save")} onPress={save} />
        {existing ? <Button kind="danger" title={t("roster.deleteEvent")} onPress={del} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
