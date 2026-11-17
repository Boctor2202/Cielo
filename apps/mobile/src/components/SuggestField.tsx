import React from "react";
import { ScrollView, View } from "react-native";
import { Chip, Field } from "./ui";
import { space } from "../theme";

/**
 * Free text with one-tap suggestions underneath (the mobile form of the web's datalist): the chips
 * narrow down as the pilot types; a tap fills the field.
 */
export function SuggestField({
  label,
  value,
  onChange,
  options,
  placeholder,
  max = 12,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  max?: number;
}) {
  const q = value.trim().toLowerCase();
  const shown = (q ? options.filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q) : options).slice(0, max);
  return (
    <View style={{ gap: space.xs }}>
      <Field label={label} value={value} onChangeText={onChange} placeholder={placeholder} />
      {shown.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.xs }}>
          {shown.map((o) => (
            <Chip key={o} label={o} selected={o === value} onPress={() => onChange(o)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
