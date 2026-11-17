import React from "react";
import { formatDuration, parseDuration } from "@cielo/core";
import { Field } from "./ui";

/** Keypad digits as they are typed: "1" -> "1", "130" -> "1:30", "1305" -> "13:05" (minutes are the last two digits). */
export function digitsToDuration(s: string): string {
  const d = s.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, -2)}:${d.slice(-2)}` : d;
}

/**
 * Canonical h:mm through @cielo/core ("1:75" -> "2:15"); "" stays "". Digits typed without a colon read
 * like a clock, minutes last: "45" -> "0:45", "130" -> "1:30", "5" -> "0:05".
 */
export function normDuration(s: string): string {
  const raw = s.trim();
  const m = parseDuration(/^\d+$/.test(raw) ? digitsToDuration(raw.padStart(3, "0")) : raw);
  return m === null ? "" : formatDuration(m);
}

/** h:mm duration entered on the numeric keypad; empty means "not set". */
export function DurationField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <Field
      label={label}
      hint={hint}
      value={value}
      monoValue
      placeholder="h:mm"
      keyboardType="number-pad"
      maxLength={5}
      onChangeText={(s) => onChange(digitsToDuration(s))}
      onBlur={() => onChange(normDuration(value))}
      error={!!value && parseDuration(value) === null}
    />
  );
}
