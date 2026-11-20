import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { MaxFeature } from "@cielo/core";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Button, Card, Screen, Txt } from "./ui";

/** Instead of a screen the plan does not include (Max), or when writing is off (no subscription). */
export function Paywall({ feature }: { feature?: MaxFeature }) {
  const { t, access } = useApp();
  const c = useTheme();
  const needsMax = !!feature && access.plan === "basic";
  return (
    <Screen>
      <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
        <Ionicons name={needsMax ? "sparkles-outline" : "lock-closed-outline"} size={28} color={c.accent} />
        <Txt variant="h2" style={{ textAlign: "center" }}>{needsMax ? t("access.maxTitle") : t("access.readOnlyTitle")}</Txt>
        <Txt variant="muted" style={{ textAlign: "center" }}>{needsMax ? t("access.maxText") : t("access.readOnlyText")}</Txt>
        <Button title={needsMax ? t("access.upgrade") : t("access.subscribe")} onPress={() => router.push("/subscription")} />
      </Card>
    </Screen>
  );
}

/** Renders the screen only when the plan includes the feature. */
export function Requires({ feature, children }: { feature: MaxFeature; children: React.ReactNode }) {
  const { access } = useApp();
  return access.has(feature) ? <>{children}</> : <Paywall feature={feature} />;
}

/** Demo days left, or read-only, at the top of the dashboard. */
export function AccessBanner() {
  const { t, access } = useApp();
  const c = useTheme();
  if (access.trial && access.daysLeft) {
    return (
      <Card>
        <Txt>{t("access.trial", { n: access.daysLeft })}</Txt>
        <Button kind="secondary" title={t("access.subscribe")} onPress={() => router.push("/subscription")} />
      </Card>
    );
  }
  if (access.demo && access.daysLeft) {
    return (
      <Card>
        <Txt>{t("access.demo", { n: access.daysLeft })}</Txt>
        {/* a subscriber on a new phone lands here until they sign in */}
        <Button kind="secondary" title={t("access.haveAccount")} onPress={() => router.push("/auth")} />
        <Button title={t("access.startTrial")} onPress={() => router.push("/auth")} />
      </Card>
    );
  }
  if (!access.canWrite) {
    return (
      <Card>
        <View style={{ gap: 8 }}>
          <Txt color={c.caution} style={{ fontWeight: "600" }}>{t("access.readOnlyTitle")}</Txt>
          <Txt variant="muted">{t("access.readOnlyBanner")}</Txt>
          <Button title={t("access.subscribe")} onPress={() => router.push("/subscription")} />
        </View>
      </Card>
    );
  }
  return null;
}
