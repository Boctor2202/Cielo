import React from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { Chip, Field } from "./ui";
import { useApp } from "../state";
import { space } from "../theme";

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
  const { t } = useApp();
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
      <Field
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
