import React from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { countryName } from "@cielo/core";
import { lookupAirport } from "../airports";
import { useApp } from "../state";
import { space, useTheme } from "../theme";
import { useAircraftPhoto } from "./AircraftPhoto";
import { Track } from "./Bars";
import { Flag } from "./Flag";
import { Card, Row, Txt } from "./ui";

/** Gold, silver, bronze for the podium. */
const PODIUM = ["#E9C25A", "#C7CCD4", "#D08A57"];

/** The most visited airports: podium ranks, flag, city and country, and a bar for the movements. */
export function TopAirports({ title, items }: { title: string; items: { key: string; flights: number }[] }) {
  const { t, locale } = useApp();
  const c = useTheme();
  if (!items.length) return null;
  const max = Math.max(1, ...items.map((x) => x.flights));
  return (
    <Card>
      <Txt variant="h2">{title}</Txt>
      {items.map((a, i) => {
        const ap = lookupAirport(a.key);
        return (
          <View key={a.key} style={{ gap: 6 }}>
            <Row gap={10} style={{ alignItems: "center" }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: i < 3 ? PODIUM[i] : "transparent" }}>
                <Txt mono style={{ fontSize: 12, fontWeight: "800" }} color={i < 3 ? "#1a1206" : c.muted}>{i + 1}</Txt>
              </View>
              {ap ? <Flag code={ap.country} size={22} /> : <View style={{ width: 22 }} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Row gap={6} style={{ alignItems: "baseline" }}>
                  <Txt mono style={{ fontWeight: "800" }}>{a.key}</Txt>
                  <Txt numberOfLines={1} style={{ flex: 1 }}>{ap?.city || ap?.name || ""}</Txt>
                </Row>
                <Txt variant="small" numberOfLines={1} style={{ fontSize: 11 }}>{[ap?.name !== ap?.city ? ap?.name : "", ap ? countryName(ap.country, locale) : ""].filter(Boolean).join(" · ")}</Txt>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Txt mono style={{ fontSize: 16, fontWeight: "800" }}>{a.flights.toLocaleString()}</Txt>
                <Txt variant="small" style={{ fontSize: 9, letterSpacing: 0.8 }}>{t("stats.movementsShort").toUpperCase()}</Txt>
              </View>
            </Row>
            <View style={{ marginLeft: 36 }}>
              <Track ratio={a.flights / max} height={6} />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export interface FleetItem {
  reg: string;
  minutes: number;
  flights: number;
  type?: string;
  model?: string;
}

/** The aircraft flown most, side by side: the photo of each one (Planespotters, credited), hours and flights. */
export function Fleet({ title, items, format }: { title: string; items: FleetItem[]; format: (m: number) => string }) {
  if (!items.length) return null;
  const total = items.reduce((x, r) => x + r.minutes, 0) || 1;
  return (
    <Card>
      <Txt variant="h2">{title}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -(space.lg + 2) }} contentContainerStyle={{ paddingHorizontal: space.lg + 2, gap: 12 }}>
        {items.map((r, i) => (
          <Tile key={r.reg} item={r} first={i === 0} share={r.minutes / total} format={format} />
        ))}
      </ScrollView>
    </Card>
  );
}

const W = 220;

function Tile({ item: r, first, share, format }: { item: FleetItem; first: boolean; share: number; format: (m: number) => string }) {
  const { t } = useApp();
  const c = useTheme();
  const photo = useAircraftPhoto(r.reg);
  const open = photo ? () => void Linking.openURL(photo.link) : undefined;
  const line = c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.10)";
  return (
    <View style={{ width: W, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: line, backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(10,22,38,0.03)" }}>
      <Pressable onPress={open} disabled={!open} accessibilityRole={open ? "link" : undefined} accessibilityLabel={open ? t("photo.open") : undefined}>
        <View style={{ width: W, height: (W * 2) / 3, backgroundColor: "#12304d", alignItems: "center", justifyContent: "center" }}>
          {photo ? (
            // shown straight from Planespotters, unchanged and not stored on the device
            <Image source={{ uri: photo.src }} cachePolicy="none" contentFit="contain" transition={250} style={{ width: W, height: (W * 2) / 3 }} accessibilityLabel={t("photo.alt", { reg: r.reg })} />
          ) : (
            <View style={{ alignItems: "center", gap: 4, opacity: photo === undefined ? 0.4 : 0.75 }}>
              <Ionicons name="airplane" size={34} color="#ffffff" style={{ transform: [{ rotate: "-90deg" }] }} />
              {r.type ? <Txt mono color="#ffffff" style={{ fontSize: 12, fontWeight: "700", letterSpacing: 2 }}>{r.type}</Txt> : null}
            </View>
          )}
          {first ? (
            <View style={{ position: "absolute", left: 8, top: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Txt style={{ fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 }} color="#FCD34D">{t("stats.mostFlown").toUpperCase()}</Txt>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={{ padding: 12, gap: 6 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Txt mono style={{ fontSize: 17, fontWeight: "800" }}>{r.reg}</Txt>
          {r.type ? (
            <View style={{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: line }}>
              <Txt mono variant="small" style={{ fontSize: 11, fontWeight: "700" }}>{r.type}</Txt>
            </View>
          ) : null}
        </Row>
        {r.model ? <Txt variant="small" numberOfLines={1} style={{ marginTop: -4 }}>{r.model}</Txt> : null}
        <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <View>
            <Txt mono style={{ fontSize: 16, fontWeight: "800" }}>{format(r.minutes)}</Txt>
            <Txt variant="small" style={{ fontSize: 9, letterSpacing: 0.8 }}>{t("stats.hoursShort").toUpperCase()}</Txt>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Txt mono style={{ fontSize: 16, fontWeight: "800" }}>{r.flights.toLocaleString()}</Txt>
            <Txt variant="small" style={{ fontSize: 9, letterSpacing: 0.8 }}>{t("stats.flightsShort").toUpperCase()}</Txt>
          </View>
        </Row>
        <Track ratio={share} height={4} />
        {photo ? (
          <Pressable onPress={open} hitSlop={6}>
            <Txt variant="small" numberOfLines={1} style={{ fontSize: 10 }}>
              {t("photo.credit", { name: photo.photographer })} <Txt variant="small" style={{ fontSize: 10, textDecorationLine: "underline" }}>Planespotters.net</Txt>
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
