import React from "react";
import { formatDuration, parseDuration } from "@cielo/core";
import { Field } from "./ui";

/** Keypad digits as they are typed: "1" -> "1", "130" -> "1:30", "1305" -> "13:05". */
export function digitsToDuration(s: string): string {
  const d = s.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, -2)}:${d.slice(-2)}` : d;
}

/** Canonical h:mm through @cielo/core ("1" -> "1:00", "1:75" -> "2:15"); "" stays "". */
export function normDuration(s: string): string {
  const m = parseDuration(s);
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
