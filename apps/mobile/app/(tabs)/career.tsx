import React from "react";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MenuGroup, MenuRow, Screen } from "../../src/components/ui";
import { useApp } from "../../src/state";

/** Career: the experience the logbook proves, and what to do with it (goals, job offers, CV). */
export default function Career() {
  const { t } = useApp();
  const ico = (name: React.ComponentProps<typeof Ionicons>["name"]) => <Ionicons name={name} size={17} color="#fff" />;
  return (
    <Screen>
      <MenuGroup>
        <MenuRow icon={ico("bar-chart")} color="#32D74B" label={t("tabs.experience")} onPress={() => router.navigate("/stats")} />
        <MenuRow icon={ico("pulse")} color="#34C759" label={t("cur.title")} onPress={() => router.navigate("/currency")} />
        <MenuRow icon={ico("flag")} color="#FF9F0A" label={t("goals.title")} onPress={() => router.navigate("/goals")} />
        <MenuRow icon={ico("briefcase")} color="#AC8E68" label={t("more.jobs")} onPress={() => router.navigate("/jobs")} />
        <MenuRow icon={ico("document-text")} color="#30B0C7" label={t("more.cv")} onPress={() => router.navigate("/cv")} />
      </MenuGroup>
    </Screen>
  );
}
