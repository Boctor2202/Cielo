import React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { ACCENTS, BACKDROPS, setAccent, setBackdrop, setThemePref, useLook, useScheme, type AccentId, type BackdropId, type ThemePref } from "../appearance";
import { useApp } from "../state";
import type { I18nKey } from "../i18n";
import { Txt } from "./ui";

const BASE: Record<BackdropId | "pearl", [string, string]> = {
  midnight: ["#0B1830", "#03060F"],
  black: ["#0B0B0E", "#000000"],
  slate: ["#20262F", "#0D1014"],
  pearl: ["#F8FAFC", "#E5EBF2"],
};

/** A small picture of a backdrop, with the chosen colour's glow. */
function Swatch({ id, accent, w, h }: { id: BackdropId | "pearl"; accent: string; w: number; h: number }) {
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={`sw-${id}`} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={BASE[id][0]} />
          <Stop offset="1" stopColor={BASE[id][1]} />
        </LinearGradient>
        <RadialGradient id={`swg-${id}`} cx="0.9" cy="0" rx="0.9" ry="0.8" fx="0.9" fy="0" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={accent} stopOpacity={id === "pearl" ? 0.3 : 0.45} />
          <Stop offset="1" stopColor={accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill={`url(#sw-${id})`} />
      <Rect width={w} height={h} fill={`url(#swg-${id})`} />
    </Svg>
  );
}

/**
 * Réglages › Apparence: the colour used across the app and the backdrop. "Pearl" is the light mode; the three
 * others are dark. Kept on this device and applied at once.
 */
export function AppearancePicker({ theme, onTheme }: { theme: ThemePref; onTheme: (p: ThemePref) => void }) {
  const { t } = useApp();
  const look = useLook();
  const scheme = useScheme();
  const { width } = useWindowDimensions();
  const tileW = Math.min(160, (Math.min(width, 760) - 32 - 36 - 12) / 2);
  const ring = scheme === "dark" ? "#ffffff" : "#0A1626";
  const pick = (f: () => void) => {
    void Haptics.selectionAsync().catch(() => {});
    f();
  };
  const chooseBackdrop = (id: BackdropId | "pearl") =>
    pick(() => {
      if (id === "pearl") {
        onTheme("light");
        setThemePref("light");
        return;
      }
      setBackdrop(id);
      if (theme !== "dark") {
        onTheme("dark");
        setThemePref("dark");
      }
    });
  const current: BackdropId | "pearl" = scheme === "light" ? "pearl" : look.backdrop;
  return (
    <View style={{ gap: 12 }}>
      <Txt variant="label">{t("look.accent")}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 14 }}>
        {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
          const col = ACCENTS[id][scheme];
          const on = look.accent === id;
          return (
            <Pressable key={id} onPress={() => pick(() => setAccent(id))} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t(`look.a.${id}` as I18nKey)} style={{ width: "25%", alignItems: "center", gap: 5 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: on ? 2 : 0, borderColor: ring }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: col, alignItems: "center", justifyContent: "center" }}>
                  {on ? <Ionicons name="checkmark" size={20} color={scheme === "dark" ? "#0A1626" : "#ffffff"} /> : null}
                </View>
              </View>
              <Txt variant="small" style={{ fontSize: 11 }}>{t(`look.a.${id}` as I18nKey)}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt variant="label">{t("look.backdrop")}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {([...BACKDROPS, "pearl"] as const).map((id) => {
          const on = current === id;
          return (
            <Pressable key={id} onPress={() => chooseBackdrop(id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t(`look.b.${id}` as I18nKey)}>
              <View style={{ borderRadius: 16, padding: 2, borderWidth: 2, borderColor: on ? ACCENTS[look.accent][scheme] : "transparent" }}>
                <View style={{ borderRadius: 12, overflow: "hidden" }}>
                  <Swatch id={id} accent={ACCENTS[look.accent][id === "pearl" ? "light" : "dark"]} w={tileW} h={72} />
                  <Txt style={{ position: "absolute", left: 10, bottom: 7, fontSize: 12, fontWeight: "700" }} color={id === "pearl" ? "#0A1626" : "#ffffff"}>
                    {t(`look.b.${id}` as I18nKey)}
                  </Txt>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Txt variant="small">{t("look.hint")}</Txt>
    </View>
  );
}
