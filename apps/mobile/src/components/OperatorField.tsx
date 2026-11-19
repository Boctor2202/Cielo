import React, { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { searchOperators } from "@cielo/core";
import { airlines } from "../airlines";
import { glass, useTheme } from "../theme";
import { Txt } from "./ui";

/**
 * Operator search: matches what is typed against the logbook's operators and the airlines of the world (name,
 * ICAO or IATA code, call sign). Free text stays allowed.
 */
export function OperatorField({
  value,
  onChange,
  known,
  placeholder,
  dark,
  inputStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  known: string[];
  placeholder?: string;
  dark?: boolean;
  inputStyle?: object;
}) {
  const c = useTheme();
  const [focus, setFocus] = useState(false);
  const hits = useMemo(() => (focus ? searchOperators(value, known, 6, airlines()) : []), [focus, value, known]);
  const text = dark ? "#fff" : c.text;
  const sub = dark ? "rgba(255,255,255,0.55)" : c.muted;
  const show = hits.length > 0 && !(hits.length === 1 && hits[0]!.name === value);
  return (
    <View style={{ gap: 4 }}>
      <TextInput
        style={[{ color: text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: dark ? "rgba(255,255,255,0.1)" : glass(c).input }, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={sub}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        autoCorrect={false}
      />
      {show ? (
        <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(127,127,127,0.25)" }}>
          {hits.map((h, i) => (
            <Pressable
              key={h.name}
              onPress={() => (onChange(h.name), setFocus(false))}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: dark ? "rgba(255,255,255,0.08)" : "rgba(127,127,127,0.15)", backgroundColor: pressed ? "rgba(127,127,127,0.15)" : "transparent" })}
            >
              <Ionicons name={h.known ? "bookmark" : "business-outline"} size={14} color={h.known ? c.accent : sub} />
              <Txt color={text} numberOfLines={1} style={{ flex: 1, fontWeight: "600" }}>{h.name}</Txt>
              {h.icao ? <Txt mono variant="small" color={sub}>{h.icao}{h.iata ? ` · ${h.iata}` : ""}</Txt> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
