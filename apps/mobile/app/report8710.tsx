import React, { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { hours8710, report8710, ROWS_8710, type Cells8710 } from "@cielo/core";
import { Card, Screen, Txt } from "../src/components/ui";
import type { I18nKey } from "../src/i18n";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";

const pair = (a: string, b: string) => (a || b ? `${a || "0"} / ${b || "0"}` : "");
/** Columns of FAA Form 8710-1, III. Record of Pilot Time (headings as printed on the form). */
const COLS: { label: string; cell: (c: Cells8710) => string }[] = [
  { label: "Total", cell: (c) => hours8710(c.total) },
  { label: "Instruction Received", cell: (c) => hours8710(c.instructionReceived) },
  { label: "Solo", cell: (c) => hours8710(c.solo) },
  { label: "PIC / SIC", cell: (c) => pair(hours8710(c.pic), hours8710(c.sic)) },
  { label: "XC Instruction Received", cell: (c) => hours8710(c.xcInstruction) },
  { label: "XC Solo", cell: (c) => hours8710(c.xcSolo) },
  { label: "XC PIC / SIC", cell: (c) => pair(hours8710(c.xcPic), hours8710(c.xcSic)) },
  { label: "Instrument", cell: (c) => hours8710(c.instrument) },
  { label: "Night Instruction Received", cell: (c) => hours8710(c.nightInstruction) },
  { label: "Night T/O / Ldg", cell: (c) => (c.nightToLdg ? String(c.nightToLdg) : "") },
  { label: "Night PIC / SIC", cell: (c) => pair(hours8710(c.nightPic), hours8710(c.nightSic)) },
  { label: "Night T/O / Ldg PIC / SIC", cell: (c) => pair(c.nightToLdgPic ? String(c.nightToLdgPic) : "", c.nightToLdgSic ? String(c.nightToLdgSic) : "") },
  { label: "Number of Flights", cell: (c) => (c.flights ? String(c.flights) : "") },
];
const ROW_LABEL = { airplanes: "Airplanes", rotorcraft: "Rotorcraft", poweredLift: "Powered Lift", gliders: "Gliders", lighterThanAir: "Lighter-Than-Air", ffs: "FFS", ftd: "FTD", atd: "ATD" } as const;

/** FAA Form 8710-1 section III from the logbook, to copy into IACRA: one card per row with data. */
export default function Report8710Screen() {
  const { t, flights, aircraftTypes } = useApp();
  const c = useTheme();
  const r = useMemo(() => report8710(flights, aircraftTypes), [flights, aircraftTypes]);
  return (
    <Screen>
      <Txt variant="small">{t("r8710.subtitle")}</Txt>
      {ROWS_8710.filter((row) => r.rows[row].total > 0).map((row) => {
        const cells = r.rows[row];
        return (
          <Card key={row} style={{ gap: 4 }}>
            <Txt variant="h2">{ROW_LABEL[row]}</Txt>
            {COLS.map((col) => {
              const v = col.cell(cells);
              return v ? (
                <View key={col.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                  <Txt variant="small" style={{ flex: 1 }}>{col.label}</Txt>
                  <Txt mono style={{ fontWeight: "700" }}>{v}</Txt>
                </View>
              ) : null;
            })}
            {row === "airplanes"
              ? r.classes.map((k) => (
                  <View key={k.cls} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                    <Txt variant="small" color={c.muted}>{t("r8710.classRow", { cls: k.cls })}</Txt>
                    <Txt mono color={c.muted}>{hours8710(k.total)} · {pair(hours8710(k.pic), hours8710(k.sic))}</Txt>
                  </View>
                ))
              : null}
          </Card>
        );
      })}
      <ScrollView horizontal={false}>
        {(["noteHours", "notePicus", "noteLaunches", "noteCheck"] as const).map((k) => (
          <Txt key={k} variant="small" color={c.muted} style={{ marginBottom: 6 }}>• {t(`r8710.${k}` as I18nKey)}</Txt>
        ))}
        {r.unknown ? <Txt variant="small" color={c.warning}>• {t("r8710.noteUnknown", { n: r.unknown })}</Txt> : null}
      </ScrollView>
    </Screen>
  );
}
