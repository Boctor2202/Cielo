import React from "react";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MenuGroup, MenuRow, Screen } from "../../src/components/ui";
import { useApp } from "../../src/state";

/** Activity: what the flying around the logbook is made of (roster, duty limits, layovers, time zones, radar, map). */
export default function Activity() {
  const { t } = useApp();
  const ico = (name: React.ComponentProps<typeof Ionicons>["name"]) => <Ionicons name={name} size={17} color="#fff" />;
  return (
    <Screen>
      <MenuGroup>
        <MenuRow icon={ico("calendar")} color="#FF375F" label={t("more.roster")} onPress={() => router.navigate("/roster")} />
        <MenuRow icon={ico("timer")} color="#FF453A" label={t("more.ftl")} onPress={() => router.navigate("/ftl")} />
        <MenuRow icon={ico("bed")} color="#FF9F0A" label={t("tabs.layovers")} onPress={() => router.navigate("/layovers")} />
        <MenuRow icon={ico("globe-outline")} color="#0A84FF" label={t("tz.title")} onPress={() => router.navigate("/timezones")} />
        <MenuRow icon={ico("radio")} color="#30B0C7" label={t("tabs.radar")} onPress={() => router.navigate("/radar")} />
        <MenuRow icon={ico("map")} color="#64D2FF" label={t("more.map")} onPress={() => router.navigate("/map")} />
        <MenuRow icon={ico("moon")} color="#5856D6" label={t("nights.title")} onPress={() => router.navigate("/nights")} />
      </MenuGroup>
    </Screen>
  );
}
