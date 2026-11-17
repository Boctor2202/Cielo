import React from "react";
import { Pressable, View } from "react-native";
import { formatClock, parseClock } from "@cielo/core";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Field, Txt, tap } from "./ui";

/** "8:5" / "0830" / "830" → "08:30"; anything unreadable is kept as typed so the field shows an error. */
export const normClock = (s: string) => {
  const d = s.replace(/\D/g, "");
  const c = parseClock(d.length === 3 ? `0${d[0]}:${d.slice(1)}` : s);
  return c ? `${String(c.h).padStart(2, "0")}:${String(c.m).padStart(2, "0")}` : s.trim() === "" ? "" : s;
};

/**
 * UTC clock typed as four digits on the number pad ("0830" becomes "08:30" as it is typed), like the
 * OUT/OFF/ON/IN fields of the flight form. `now` adds a one-tap "Now" link below.
 */
export function ClockField({ label, value, onChange, now = true, required }: { label: string; value: string; onChange: (v: string) => void; now?: boolean; required?: boolean }) {
  const { t } = useApp();
  const c = useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Field
        label={label}
        value={value}
        monoValue
        placeholder="--:--"
        keyboardType="number-pad"
        maxLength={5}
        onChangeText={(s) => {
          const d = s.replace(/\D/g, "").slice(0, 4);
          onChange(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
        }}
        onBlur={() => onChange(normClock(value))}
        error={value ? !parseClock(value) : !!required}
      />
      {now ? (
        <Pressable onPress={() => (tap(), onChange(formatClock(new Date().toISOString())))} hitSlop={6}>
          <Txt variant="small" color={c.accent}>
            {t("common.now")}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
