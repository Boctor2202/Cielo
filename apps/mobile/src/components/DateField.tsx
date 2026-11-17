import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Chip, Field } from "./ui";
import { useApp } from "../state";
import { glass, space, useTheme } from "../theme";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "20261117" → "2026-11-17" as the pilot types (month mode: "202603" → "2026-03"). */
export function formatDateDigits(raw: string, month = false): string {
  const d = raw.replace(/\D/g, "").slice(0, month ? 6 : 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

export function isValidDate(s: string, month = false): boolean {
  if (month) return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T12:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/**
 * Date typed as digits on the number pad, dashes added on the fly, like the clock fields of the flight
 * form. `quick` adds one-tap chips (today, yesterday, in one year…). Empty is allowed unless `required`.
 */
export function DateField({
  label,
  value,
  onChange,
  month,
  quick,
  required,
  hint,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  month?: boolean;
  quick?: ("today" | "yesterday" | "plus1y" | "plus2y" | "plus5y")[];
  required?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { t, locale } = useApp();
  const c = useTheme();
  // the iOS calendar, next to the typed field (typing stays the fastest way for a pilot who knows the date)
  const [picking, setPicking] = useState<Date | null>(null);
  const openPicker = () => setPicking(isValidDate(value) ? new Date(`${value}T12:00:00`) : new Date());
  const bad = value ? !isValidDate(value, month) : !!required;
  const shift = (days: number, years = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setFullYear(d.getFullYear() + years);
    return isoDay(d);
  };
  const values: Record<string, string> = {
    today: shift(0),
    yesterday: shift(-1),
    plus1y: shift(0, 1),
    plus2y: shift(0, 2),
    plus5y: shift(0, 5),
  };
  return (
    <View style={[{ gap: space.xs }, style]}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.xs }}>
      <Field
        style={{ flex: 1 }}
        label={label}
        value={value}
        onChangeText={(s) => onChange(formatDateDigits(s, month))}
        keyboardType="number-pad"
        placeholder={month ? t("date.monthPh") : t("date.dayPh")}
        maxLength={month ? 7 : 10}
        monoValue
        error={bad}
        hint={hint}
      />
      {!month ? (
        <Pressable
          onPress={openPicker}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("date.pick")}
          style={{ height: 46, width: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: glass(c).strong, marginBottom: hint ? 20 : 0 }}
        >
          <Ionicons name="calendar-outline" size={20} color={c.accent} />
        </Pressable>
      ) : null}
      </View>
      {picking && Platform.OS === "android" ? (
        <DateTimePicker
          value={picking}
          mode="date"
          onChange={(e, d) => {
            setPicking(null);
            if (e.type === "set" && d) onChange(isoDay(d));
          }}
        />
      ) : null}
      {Platform.OS === "ios" ? (
        <Modal visible={!!picking} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: space.lg }} onPress={() => setPicking(null)}>
            <Pressable style={{ backgroundColor: c.bg, borderRadius: 18, padding: space.md, gap: space.sm }} onPress={() => undefined}>
              {picking ? (
                <DateTimePicker
                  value={picking}
                  mode="date"
                  display="inline"
                  locale={locale}
                  themeVariant={c.scheme === "dark" ? "dark" : "light"}
                  accentColor={c.accent}
                  onChange={(_, d) => d && setPicking(d)}
                />
              ) : null}
              <Button
                title={t("common.ok")}
                onPress={() => {
                  if (picking) onChange(isoDay(picking));
                  setPicking(null);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {quick?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          {quick.map((q) => (
            <Chip key={q} label={t(`date.${q}`)} selected={value === values[q]} onPress={() => onChange(values[q]!)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
