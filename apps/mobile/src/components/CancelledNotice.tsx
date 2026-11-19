import React from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../state";
import { Row, Txt } from "./ui";

/** « Résilié : accès jusqu'au … », in amber. */
export function CancelledNotice({ endsAt }: { endsAt: string }) {
  const { t, locale } = useApp();
  const date = new Date(endsAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Row style={{ alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(251,191,36,0.45)", backgroundColor: "rgba(251,191,36,0.1)" }}>
      <Ionicons name="calendar-clear-outline" size={16} color="#fbbf24" style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: "700" }}>{t("account.cancelled", { date })}</Txt>
        <Txt variant="small">{t("account.cancelledHint")}</Txt>
      </View>
    </Row>
  );
}
