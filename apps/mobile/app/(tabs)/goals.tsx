import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GOAL_KINDS, defaultGoals, formatDuration, goalProgress, isHourGoal, type GoalKind, type PilotGoal } from "@cielo/core";
import { Button, Card, Chip, Field, Row, Screen, Txt, tap } from "../../src/components/ui";
import { Track } from "../../src/components/Bars";
import { DateField } from "../../src/components/DateField";
import { formatDate, formatMonth, type I18nKey } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

type Draft = PilotGoal & { value: string };

/**
 * The pilot's goals (shared with the website): progress worked out from the logbook and carried totals, the
 * pace needed to meet a deadline, and an editor to set them.
 */
export default function Goals() {
  const { t, locale, flights, balances, aircraftTypes, pilot, savePilot, access } = useApp();
  const c = useTheme();
  const today = todayUtc();
  const [editing, setEditing] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const jet = (icao: string) => aircraftTypes.find((x) => x.icao === icao)?.engineType === "jet";
  const mine = pilot.goals?.length ? pilot.goals : defaultGoals(flights, balances);
  const progress = useMemo(() => mine.map((g) => goalProgress(g, flights, balances, today, jet)), [mine, flights, balances, today]);
  const typesFlown = useMemo(() => [...new Set(flights.filter((f) => !f.deletedAt && !f.isFstd && f.aircraftTypeIcao).map((f) => f.aircraftTypeIcao!))].sort(), [flights]);

  const name = (g: PilotGoal) =>
    t(`goals.kind.${g.kind}` as I18nKey, { n: isHourGoal(g.kind) ? Math.round(g.target / 60).toLocaleString(locale) : g.target.toLocaleString(locale), icao: g.icao ?? "" });
  const val = (g: PilotGoal, v: number) => (isHourGoal(g.kind) ? formatDuration(v, pilot.timeDisplay) : String(v));

  const startEdit = () => setEditing((pilot.goals ?? []).map((g) => ({ ...g, value: String(isHourGoal(g.kind) ? Math.round(g.target / 60) : g.target) })));
  const set = (i: number, patch: Partial<Draft>) => setEditing((l) => (l ? l.map((g, j) => (j === i ? { ...g, ...patch } : g)) : l));
  const save = async (next: PilotGoal[] | undefined) => {
    setBusy(true);
    try {
      await savePilot({ goals: next });
      tap("success");
      setEditing(null);
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const valid = editing?.every((g) => Number(g.value) > 0 && (g.kind !== "type" || !!g.icao)) ?? false;

  if (editing) {
    return (
      <Screen>
        <Txt variant="small">{t("goals.intro")}</Txt>
        {editing.map((g, i) => (
          <Card key={g.id}>
            <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="label">{t("goals.goal")}</Txt>
              <Pressable onPress={() => setEditing((l) => (l ? l.filter((_, j) => j !== i) : l))} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={c.muted} />
              </Pressable>
            </Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
              {GOAL_KINDS.map((k) => (
                <Chip key={k} label={t(`goals.pick.${k}` as I18nKey)} selected={g.kind === k} onPress={() => set(i, { kind: k as GoalKind })} />
              ))}
            </ScrollView>
            {g.kind === "type" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
                {typesFlown.map((x) => (
                  <Chip key={x} label={x} selected={g.icao === x} onPress={() => set(i, { icao: x })} />
                ))}
              </ScrollView>
            ) : null}
            <Field
              label={isHourGoal(g.kind) ? t("goals.targetHours") : t("goals.targetCount")}
              value={g.value}
              onChangeText={(v) => set(i, { value: v.replace(/\D/g, "").slice(0, 6) })}
              keyboardType="number-pad"
              monoValue
            />
            <DateField label={t("goals.by")} value={g.by ?? ""} onChange={(v) => set(i, { by: v || undefined })} />
          </Card>
        ))}
        <Button kind="secondary" title={t("goals.add")} onPress={() => setEditing((l) => [...(l ?? []), { id: `g${Date.now()}`, kind: "total", target: 0, value: "" }])} />
        <Button
          title={t("common.save")}
          loading={busy}
          disabled={!valid}
          onPress={() =>
            void save(
              editing.length
                ? editing.map(({ value, ...g }) => ({ ...g, icao: g.kind === "type" ? g.icao : undefined, target: isHourGoal(g.kind) ? Number(value) * 60 : Number(value) }))
                : undefined,
            )
          }
        />
        {pilot.goals?.length ? <Button kind="ghost" title={t("goals.reset")} onPress={() => void save(undefined)} /> : null}
        <Button kind="ghost" title={t("common.cancel")} onPress={() => setEditing(null)} />
        <View style={{ height: space.md }} />
      </Screen>
    );
  }

  return (
    <Screen columns>
      {!pilot.goals?.length ? <Txt variant="small">{t("goals.auto")}</Txt> : null}
      {progress.map((p) => (
        <Card key={p.goal.id}>
          <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <Txt style={{ fontWeight: "700", flex: 1 }}>{name(p.goal)}</Txt>
            <Txt mono variant="small" color={p.reached ? c.success : c.muted}>{Math.round(p.ratio * 100)}%</Txt>
          </Row>
          <Track ratio={p.ratio} color={p.reached ? c.success : c.accent} />
          <Row style={{ justifyContent: "space-between" }}>
            <Txt mono variant="small">{val(p.goal, p.done)}</Txt>
            <Txt mono variant="small">{t("goals.of", { v: val(p.goal, p.goal.target) })}</Txt>
          </Row>
          {!p.reached ? (
            <Txt variant="small" color={p.onTrack === false ? c.caution : undefined}>
              {p.eta
                ? `${t("goals.eta", { date: formatMonth(p.eta.slice(0, 7), locale) })}${p.onTrack === false ? ` ${t("goals.late")}` : ""}`
                : t("goals.noPace")}
            </Txt>
          ) : null}
          {p.goal.by ? (
            <Txt variant="small" color={p.daysLeft !== undefined && p.daysLeft < 0 && !p.reached ? c.warning : undefined}>
              {t("goals.deadline", { date: formatDate(p.goal.by, locale) })}
              {p.perMonth ? ` · ${t("goals.pace", { n: val(p.goal, p.perMonth) })}` : ""}
            </Txt>
          ) : null}
        </Card>
      ))}
      <Button title={t("goals.edit")} onPress={() => (access.canWrite ? startEdit() : Alert.alert(t("access.readOnlyBanner")))} />
      <Txt variant="small">{t("goals.recencyNote")}</Txt>
      <View style={{ height: space.md }} />
    </Screen>
  );
}
