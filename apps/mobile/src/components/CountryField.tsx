import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { countryName, searchCountries } from "@cielo/core";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Field, Txt } from "./ui";

/** Country (ISO code stored), searched by name in the user's language, English name or code. */
export function CountryField({ label, value, onChange }: { label: string; value?: string; onChange: (code: string | undefined) => void }) {
  const { locale } = useApp();
  const c = useTheme();
  const [q, setQ] = useState(value ? countryName(value, locale) : "");
  const [focused, setFocused] = useState(false);
  useEffect(() => setQ(value ? countryName(value, locale) : ""), [value, locale]);
  const results = useMemo(() => (focused ? searchCountries(q, locale, 6) : []), [q, focused, locale]);
  return (
    <View style={{ gap: 4 }}>
      <Field
        label={label}
        value={q}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChangeText={(v) => {
          setQ(v);
          if (!v) onChange(undefined);
        }}
      />
      {results.length && !(results.length === 1 && results[0]!.code === value) ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.bg, overflow: "hidden" }}>
          {results.map((r) => (
            <Pressable
              key={r.code}
              onPress={() => {
                onChange(r.code);
                setQ(r.name);
                setFocused(false);
              }}
              style={({ pressed }) => ({ padding: 10, opacity: pressed ? 0.6 : 1 })}
            >
              <Txt>
                {r.name} <Txt variant="small" mono>{r.code}</Txt>
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
