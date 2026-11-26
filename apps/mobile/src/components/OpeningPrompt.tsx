import React, { useEffect, useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Txt, tap } from "./ui";
import { useApp } from "../state";
import { useTheme } from "../theme";

const KEY = "openingPromptDismissed";

/**
 * "Already have hours?": a new logbook (few flights, no carried-forward totals) is offered to carry the totals
 * of the old logbooks over instead of typing or photographing every page. Hidden for good once dismissed.
 */
export function OpeningPrompt({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t, flights, balances, store } = useApp();
  const c = useTheme();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    void store.getMeta(KEY).then((v) => setDismissed(!!v));
  }, [store]);
  if (dismissed || balances.some((b) => !b.deletedAt) || flights.length >= 50) return null;
  const hide = () => {
    tap();
    setDismissed(true);
    void store.setMeta(KEY, new Date().toISOString());
  };
  return (
    <View style={[{ borderRadius: 18, padding: 14, paddingRight: 36, gap: 8, borderWidth: 1, borderColor: c.accent + "59", backgroundColor: c.accent + "12" }, style]}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: c.accent + "26" }}>
          <Ionicons name="albums" size={17} color={c.accent} />
        </View>
        <Txt style={{ flex: 1, fontWeight: "700" }}>{t("openp.title")}</Txt>
      </View>
      <Txt variant="small">{t("openp.text")}</Txt>
      <Button small title={t("openp.cta")} onPress={() => (tap(), router.navigate("/opening"))} />
      <Pressable onPress={hide} hitSlop={10} accessibilityLabel={t("openp.later")} style={{ position: "absolute", right: 10, top: 10 }}>
        <Ionicons name="close" size={18} color={c.muted} />
      </Pressable>
    </View>
  );
}
