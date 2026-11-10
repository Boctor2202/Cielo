import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { Airport } from "@cielo/core";
import { airports } from "../airports";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Field, Txt } from "./ui";

/** ICAO input with live search (ICAO / IATA / name / city) on the bundled airport index. */
export function AirportField({ label, value, onChange }: { label: string; value: string; onChange: (icao: string) => void }) {
  const { t } = useApp();
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Airport[]>([]);
  useEffect(() => setQuery(value), [value]);

  const match = useMemo(() => (value ? airports().get(value) : undefined), [value]);

  useEffect(() => {
    if (!focused || query.length < 2) return setResults([]);
    const h = setTimeout(() => setResults(airports().search(query, 6)), 150);
    return () => clearTimeout(h);
  }, [query, focused]);

  const pick = (a: Airport) => {
    onChange(a.icao);
    setQuery(a.icao);
    setResults([]);
  };

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Field
        label={label}
        value={query}
        monoValue
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={t("airport.placeholder")}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const a = airports().get(query);
          const code = a?.icao ?? query.trim().toUpperCase();
          if (code !== value) onChange(code);
          setQuery(code);
        }}
        onChangeText={(s) => {
          setQuery(s);
          const a = s.length === 4 ? airports().get(s) : undefined;
          if (a) onChange(a.icao);
        }}
        error={!!value && !match}
      />
      <Txt variant="small" numberOfLines={1}>
        {match ? `${match.name}${match.city ? ` · ${match.city}` : ""}` : value ? t("airport.unknown") : " "}
      </Txt>
      {focused && results.length > 0 ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.surface, overflow: "hidden" }}>
          {results.map((a) => (
            <Pressable key={a.icao} onPress={() => pick(a)} style={({ pressed }) => ({ padding: 10, opacity: pressed ? 0.6 : 1 })}>
              <Txt mono style={{ fontWeight: "600" }}>
                {a.icao}
                {a.iata ? ` / ${a.iata}` : ""}
              </Txt>
              <Txt variant="small" numberOfLines={1}>
                {a.name} · {a.country}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
