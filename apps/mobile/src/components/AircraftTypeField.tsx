import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { AircraftType } from "@cielo/core";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Field, Txt, tap } from "./ui";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Search over aircraft types (ICAO designator, manufacturer, model): the reference table and the pilot's own types.
 * With `onCreate`, offers to create a type that is not in the list (called with the current query).
 */
export function AircraftTypeField({
  types,
  label,
  hint,
  onPick,
  onCreate,
}: {
  types: AircraftType[];
  label: string;
  hint?: string;
  onPick: (t: AircraftType) => void;
  onCreate?: (query: string) => void;
}) {
  const c = useTheme();
  const { t: tr } = useApp();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = norm(q.trim());
    if (!s) return [];
    const rank = (t: AircraftType) => {
      const icao = norm(t.icao);
      return icao === s ? 0 : icao.startsWith(s) ? 1 : norm(t.model).startsWith(s) ? 2 : norm(`${t.manufacturer} ${t.model}`).includes(s) ? 3 : 9;
    };
    return types.filter((t) => !t.deletedAt).map((t) => ({ t, r: rank(t) })).filter((x) => x.r < 9).sort((a, b) => a.r - b.r || a.t.icao.localeCompare(b.t.icao)).slice(0, 6).map((x) => x.t);
  }, [types, q]);
  return (
    <View style={{ gap: 4 }}>
      <Field label={label} value={q} onChangeText={setQ} placeholder="A320, Citation, PC-12…" autoCorrect={false} />
      {hint && !results.length ? <Txt variant="small">{hint}</Txt> : null}
      {results.length ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.bg, overflow: "hidden" }}>
          {results.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                setQ("");
                onPick(t);
              }}
              style={({ pressed }) => ({ padding: 10, opacity: pressed ? 0.6 : 1 })}
            >
              <Txt mono style={{ fontWeight: "600" }}>{t.icao}{t.classOrTypeRating ? ` · ${t.classOrTypeRating}` : ""}</Txt>
              <Txt variant="small" numberOfLines={1}>
                {t.manufacturer} {t.model}
                {t.ownerPilotId ? ` · ${tr("acft.customType")}` : ""}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
      {onCreate ? (
        <Pressable accessibilityRole="button" onPress={() => (tap(), onCreate(q))} hitSlop={6} style={{ paddingVertical: 4 }}>
          <Txt variant="small" color={c.accent}>
            {tr("acft.createType")}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "TR A320", "TR C680A"; class ratings ("SEP(L)", "MEP(L)") as they are. */
export function ratingTitle(t: { icao: string; classOrTypeRating?: string }): string {
  const r = t.classOrTypeRating?.trim();
  if (!r) return `TR ${t.icao}`;
  return /\(|^(SEP|MEP|SET|TMG)/i.test(r) ? r : `TR ${r}`;
}
