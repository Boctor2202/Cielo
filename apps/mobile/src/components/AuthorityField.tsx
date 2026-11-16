import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AUTHORITIES, searchAuthorities } from "@cielo/core";
import { useTheme } from "../theme";
import { Field, Txt } from "./ui";

/** Licence authority with search (acronym, full name, country); free text is kept as typed. */
export function AuthorityField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const results = useMemo(() => (focused ? searchAuthorities(value, 6) : []), [focused, value]);
  const known = AUTHORITIES.find((a) => a.label === value);
  return (
    <View style={{ gap: 4 }}>
      <Field label={label} value={value} autoCorrect={false} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} onChangeText={onChange} />
      {known ? <Txt variant="small" numberOfLines={1}>{known.name} · {known.country}</Txt> : null}
      {focused && results.length > 0 && !(results.length === 1 && results[0]!.label === value) ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.bg, overflow: "hidden" }}>
          {results.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onChange(a.label);
                setFocused(false);
              }}
              style={({ pressed }) => ({ padding: 10, opacity: pressed ? 0.6 : 1 })}
            >
              <Txt style={{ fontWeight: "600" }}>{a.label}</Txt>
              <Txt variant="small" numberOfLines={1}>{a.name} · {a.country}</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
