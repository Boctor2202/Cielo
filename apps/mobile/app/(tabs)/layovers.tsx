import React, { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { countryName } from "@cielo/core";
import { Flag } from "../../src/components/Flag";
import { Roll } from "../../src/components/Roll";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, EmptyState, Row, Screen, Txt, tap } from "../../src/components/ui";
import { lookupAirport } from "../../src/airports";
import { AirportField } from "../../src/components/AirportField";
import { DateField } from "../../src/components/DateField";
import { formatDate } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { Requires } from "../../src/components/Access";
import { useTheme } from "../../src/theme";

const GREEN = "#22C55E";
const INDIGO = "#818CF8";
const SKY = "#38BDF8";
const AMBER = "#F59E0B";

/** A tear-off calendar day. */
function DayBlock({ d, m, color }: { d: string; m: string; color: string }) {
  const c = useTheme();
  return (
    <View style={{ width: 52, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,22,38,0.12)" }}>
      <View style={{ backgroundColor: color, paddingVertical: 2, alignItems: "center" }}>
        <Txt style={{ fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }} color="#04140A">{m}</Txt>
      </View>
      <View style={{ paddingVertical: 4, alignItems: "center" }}>
        <Txt mono style={{ fontSize: 20, fontWeight: "800" }}>{d}</Txt>
      </View>
    </View>
  );
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Layovers, independent of the roster: an airport and dates are enough. */
export default function Layovers() {
  return (
    <Requires feature="layovers">
      <LayoversScreen />
    </Requires>
  );
}

function LayoversScreen() {
  const { t, layovers, put, pilot, locale } = useApp();
  const c = useTheme();
  const [adding, setAdding] = useState(false);
  const [icao, setIcao] = useState("");
  const [from, setFrom] = useState(todayUtc());
  const [to, setTo] = useState(todayUtc());
  const airport = icao.length === 4 ? lookupAirport(icao.toUpperCase()) : undefined;

  const today = todayUtc();
  const glass = c.scheme === "dark" ? "rgba(17,34,58,0.72)" : "rgba(243,246,249,0.78)";
  const edge = c.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(10,22,38,0.08)";
  const chip = c.scheme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(10,22,38,0.06)";
  type L = (typeof layovers)[number];
  const nightsOf = (l: L) => (l.arrivalUtc && l.departureUtc ? Math.max(0, Math.round((Date.parse(l.departureUtc.slice(0, 10)) - Date.parse(l.arrivalUtc.slice(0, 10))) / 86_400_000)) : 0);
  const { upcoming, past, stats } = useMemo(() => {
    const live = layovers.filter((l) => !l.deletedAt);
    const end = (l: L) => (l.departureUtc ?? l.arrivalUtc ?? l.createdAt).slice(0, 10);
    return {
      upcoming: live.filter((l) => end(l) >= today).sort((a, b) => (a.arrivalUtc ?? "").localeCompare(b.arrivalUtc ?? "")),
      past: live.filter((l) => end(l) < today).sort((a, b) => (b.arrivalUtc ?? "").localeCompare(a.arrivalUtc ?? "")),
      stats: {
        count: live.length,
        nights: live.reduce((s, l) => s + nightsOf(l), 0),
        airports: new Set(live.map((l) => l.airportIcao)).size,
        countries: new Set(live.map((l) => lookupAirport(l.airportIcao)?.country).filter(Boolean)).size,
      },
    };
  }, [layovers, today]);
  const when = (l: L) => {
    const a = (l.arrivalUtc ?? "").slice(0, 10);
    if (!a || a <= today) return { text: t("lay.now"), live: true };
    const d = Math.round((Date.parse(a) - Date.parse(today)) / 86_400_000);
    return { text: d === 1 ? t("lay.tomorrow") : t("dash.inDays", { n: d }), live: false };
  };
  const day = (iso?: string | null) => (iso ? { d: iso.slice(8, 10), m: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(iso)).replace(".", "").toUpperCase() } : null);

  const create = async () => {
    if (!airport) return Alert.alert(t("lay.unknownAirport"));
    const rec = await put("layovers", {
      pilotId: pilot.id,
      airportIcao: icao.toUpperCase(),
      arrivalUtc: `${from}T12:00:00.000Z`,
      departureUtc: `${to >= from ? to : from}T12:00:00.000Z`,
      contacts: [],
    });
    setAdding(false);
    setIcao("");
    router.push(`/layover/${rec.id}` as never);
  };

  return (
    <Screen>
      {adding ? (
        <Card>
          <Txt variant="h2">{t("lay.new")}</Txt>
          <AirportField label={t("lay.airport")} value={icao} onChange={(v) => setIcao(v.toUpperCase())} />
          <DateField label={t("lay.arrival")} value={from} onChange={setFrom} required quick={["today", "yesterday"]} />
          <DateField label={t("lay.departure")} value={to} onChange={setTo} required hint={isDate(from) && isDate(to) && to < from ? t("lay.departureBeforeArrival") : undefined} />
          <Row gap={12}>
            <Button style={{ flex: 1 }} kind="secondary" title={t("common.cancel")} onPress={() => setAdding(false)} />
            <Button style={{ flex: 1 }} title={t("lay.create")} disabled={!airport || !isDate(from) || !isDate(to) || to < from} onPress={create} />
          </Row>
        </Card>
      ) : (
        <Button title={`+  ${t("lay.new")}`} onPress={() => setAdding(true)} />
      )}

      {layovers.length === 0 && !adding ? <EmptyState title={t("lay.empty")} hint={t("lay.emptyHint")} /> : null}

      {layovers.length ? (
        <Row gap={8} style={{ flexWrap: "wrap" }}>
          {[
            { icon: "calendar" as const, color: GREEN, label: t("lay.statLayovers"), v: stats.count },
            { icon: "bed" as const, color: INDIGO, label: t("lay.statNights"), v: stats.nights },
            { icon: "location" as const, color: SKY, label: t("lay.statAirports"), v: stats.airports },
            { icon: "globe" as const, color: AMBER, label: t("lay.statCountries"), v: stats.countries },
          ].map((x) => (
            <View key={x.label} style={{ flexGrow: 1, flexBasis: "45%", flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 18, backgroundColor: glass, borderWidth: 1, borderColor: edge }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: x.color + "26" }}>
                <Ionicons name={x.icon} size={18} color={x.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Roll text={String(x.v)} size={22} style={{ fontWeight: "700" }} />
                <Txt variant="small" numberOfLines={1} style={{ fontSize: 11.5 }}>{x.label}</Txt>
              </View>
            </View>
          ))}
        </Row>
      ) : null}

      {upcoming.length ? (
        <Row gap={8} style={{ alignItems: "center", marginTop: 4 }}>
          <Txt variant="h2">{t("lay.upcoming")}</Txt>
          <View style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, backgroundColor: GREEN + "26" }}>
            <Txt mono variant="small" color={GREEN} style={{ fontWeight: "700" }}>{String(upcoming.length)}</Txt>
          </View>
        </Row>
      ) : null}
      {upcoming.map((l) => {
        const a = lookupAirport(l.airportIcao);
        const cc = a?.country;
        const w = when(l);
        const n = nightsOf(l);
        const d1 = day(l.arrivalUtc);
        const d2 = l.departureUtc && l.departureUtc.slice(0, 10) !== l.arrivalUtc?.slice(0, 10) ? day(l.departureUtc) : null;
        return (
          <Pressable key={l.id} onPress={() => (tap(), router.push(`/layover/${l.id}` as never))} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
            <View style={{ borderRadius: 22, padding: 16, gap: 14, backgroundColor: glass, borderWidth: 1, borderColor: GREEN + "40", overflow: "hidden" }}>
              <View style={{ position: "absolute", right: -50, top: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: GREEN, opacity: 0.12 }} />
              <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <Row gap={10} style={{ flex: 1, alignItems: "center" }}>
                  {cc ? <Flag code={cc} size={34} /> : <Ionicons name="location" size={26} color={c.muted} />}
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1} style={{ fontSize: 20, fontWeight: "800" }}>{a?.city || a?.name || l.airportIcao}</Txt>
                    <Txt variant="small" numberOfLines={1}>
                      <Txt mono variant="small" style={{ fontWeight: "700" }}>{l.airportIcao}</Txt>
                      {cc ? ` · ${countryName(cc, locale) ?? cc}` : ""}
                    </Txt>
                  </View>
                </Row>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: w.live ? GREEN : GREEN + "26" }}>
                  {w.live ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#04140A" }} /> : null}
                  <Txt variant="small" style={{ fontWeight: "800", fontSize: 12 }} color={w.live ? "#04140A" : GREEN}>{w.text}</Txt>
                </View>
              </Row>
              <Row gap={10} style={{ alignItems: "center" }}>
                {d1 ? <DayBlock {...d1} color={GREEN} /> : null}
                {d2 ? (
                  <>
                    <View style={{ flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: c.muted }} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: INDIGO + "26" }}>
                      <Ionicons name="bed" size={12} color={INDIGO} />
                      <Txt variant="small" color={INDIGO} style={{ fontWeight: "700", fontSize: 12 }}>{t(n === 1 ? "lay.night" : "lay.nights", { n })}</Txt>
                    </View>
                    <View style={{ flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: c.muted }} />
                    <DayBlock {...d2} color={SKY} />
                  </>
                ) : null}
              </Row>
              <Row gap={8} style={{ alignItems: "center" }}>
                <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: l.hotelName ? chip : AMBER + "26" }}>
                  <Ionicons name="bed-outline" size={14} color={l.hotelName ? c.text : AMBER} />
                  <Txt variant="small" numberOfLines={1} color={l.hotelName ? c.text : AMBER} style={{ flexShrink: 1 }}>{l.hotelName || t("lay.noHotel")}</Txt>
                </View>
                {l.contacts?.length ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: chip }}>
                    <Ionicons name="people-outline" size={14} color={c.text} />
                    <Txt variant="small" color={c.text}>{String(l.contacts.length)}</Txt>
                  </View>
                ) : null}
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={18} color={GREEN} />
              </Row>
            </View>
          </Pressable>
        );
      })}

      {past.length ? <Txt variant="h2" style={{ marginTop: 4 }}>{t("lay.past")}</Txt> : null}
      {past.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {past.map((l, i) => {
            const a = lookupAirport(l.airportIcao);
            const n = nightsOf(l);
            return (
              <Pressable key={l.id} onPress={() => (tap(), router.push(`/layover/${l.id}` as never))}>
                <Row gap={10} style={{ alignItems: "center", paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: edge }}>
                  {a?.country ? <Flag code={a.country} size={22} /> : <Ionicons name="location-outline" size={20} color={c.muted} />}
                  <View style={{ flex: 1, gap: 1 }}>
                    <Txt numberOfLines={1} style={{ fontWeight: "700" }}>{a?.city || a?.name || l.airportIcao}</Txt>
                    <Txt variant="small" numberOfLines={1}>
                      {l.airportIcao}
                      {l.arrivalUtc ? ` · ${formatDate(l.arrivalUtc, locale)}` : ""}
                      {l.hotelName ? ` · ${l.hotelName}` : ""}
                    </Txt>
                  </View>
                  {n > 0 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: INDIGO + "26" }}>
                      <Ionicons name="bed" size={11} color={INDIGO} />
                      <Txt mono variant="small" color={INDIGO} style={{ fontWeight: "700", fontSize: 12 }}>{String(n)}</Txt>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={c.muted} />
                </Row>
              </Pressable>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
