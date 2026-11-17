import React, { useState } from "react";
import { Alert, View } from "react-native";
import { formatDuration, parseDuration, type OpeningBalance } from "@cielo/core";
import { Button, Card, Field, Row, Screen, Txt } from "../../src/components/ui";
import { DateField } from "../../src/components/DateField";
import { formatDate, type I18nKey } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

/** Times carried forward from a previous (paper) logbook, entered as H:MM or decimal hours. */
const TIMES = ["totalMin", "picMin", "copilotMin", "dualMin", "instructorMin", "multiPilotMin", "singlePilotSeMin", "singlePilotMeMin", "nightMin", "ifrMin", "fstdMin"] as const;
type TimeKey = (typeof TIMES)[number];

export default function Opening() {
  const { t, locale, balances, put, remove, pilot } = useApp();
  const c = useTheme();
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);
  const [label, setLabel] = useState("");
  const [asOf, setAsOf] = useState(todayUtc());
  const [type, setType] = useState("");
  const [times, setTimes] = useState<Partial<Record<TimeKey, string>>>({});
  const [ldgDay, setLdgDay] = useState("");
  const [ldgNight, setLdgNight] = useState("");
  const [error, setError] = useState(false);
  const live = balances.filter((b) => !b.deletedAt).sort((a, b) => b.asOfDate.localeCompare(a.asOfDate));

  const add = async () => {
    const total = parseDuration(times.totalMin ?? "");
    if (!total || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return setError(true);
    const row: Partial<OpeningBalance> = { pilotId: pilot.id, asOfDate: asOf, label: label.trim() || undefined, aircraftTypeIcao: type.trim().toUpperCase() || null, landingsDay: +ldgDay || 0, landingsNight: +ldgNight || 0 };
    for (const k of TIMES) row[k] = parseDuration(times[k] ?? "") ?? 0;
    await put("opening_balances", row);
    setLabel("");
    setType("");
    setTimes({});
    setLdgDay("");
    setLdgNight("");
    setError(false);
  };
  const del = (b: OpeningBalance) =>
    Alert.alert(t("open.deleteTitle"), b.label ?? formatDate(b.asOfDate, locale), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => void remove("opening_balances", b.id) },
    ]);

  return (
    <Screen>
      <Txt variant="muted">{t("open.intro")}</Txt>
      {live.map((b) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: "600" }}>{b.label || t("open.untitled")}</Txt>
              <Txt variant="small">{t("open.asOfShort", { date: formatDate(b.asOfDate, locale) })}{b.aircraftTypeIcao ? ` · ${b.aircraftTypeIcao}` : ""}</Txt>
            </View>
            <Txt mono style={{ fontSize: 18 }}>{fmt(b.totalMin)}</Txt>
          </Row>
          <Txt variant="small" mono>
            {TIMES.slice(1).filter((k) => b[k]).map((k) => `${t(`open.f.${k}` as I18nKey)} ${fmt(b[k])}`).join(" · ")}
          </Txt>
          <Button kind="ghost" small title={t("common.delete")} onPress={() => del(b)} />
        </Card>
      ))}
      <Card>
        <Txt variant="h2">{t("open.add")}</Txt>
        <Field label={t("open.label")} value={label} onChangeText={setLabel} placeholder={t("open.labelPh")} />
        <Row>
          <DateField style={{ flex: 1 }} label={t("open.asOf")} value={asOf} onChange={setAsOf} />
          <Field style={{ flex: 1 }} label={t("open.type")} value={type} onChangeText={setType} placeholder={t("open.allTypes")} monoValue autoCapitalize="characters" maxLength={4} />
        </Row>
        <Txt variant="small">{t("open.timeHint")}</Txt>
        {[0, 2, 4, 6, 8, 10].map((i) => (
          <Row key={i}>
            {TIMES.slice(i, i + 2).map((k) => (
              <Field
                key={k}
                style={{ flex: 1 }}
                label={t(`open.f.${k}` as I18nKey)}
                value={times[k] ?? ""}
                onChangeText={(v) => setTimes((x) => ({ ...x, [k]: v }))}
                placeholder="0:00"
                monoValue
                keyboardType="numbers-and-punctuation"
                error={k === "totalMin" && error}
              />
            ))}
            {i === 10 ? <View style={{ flex: 1 }} /> : null}
          </Row>
        ))}
        <Row>
          <Field style={{ flex: 1 }} label={t("open.ldgDay")} value={ldgDay} onChangeText={setLdgDay} keyboardType="number-pad" monoValue />
          <Field style={{ flex: 1 }} label={t("open.ldgNight")} value={ldgNight} onChangeText={setLdgNight} keyboardType="number-pad" monoValue />
        </Row>
        {error ? <Txt color={c.warning}>{t("open.required")}</Txt> : null}
        <Button title={t("common.add")} onPress={() => void add()} />
      </Card>
    </Screen>
  );
}
