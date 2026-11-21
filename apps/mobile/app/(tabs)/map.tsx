import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { File, Paths } from "expo-file-system";
import { encodeShareRoutes, shareLinkUrl, routeMapChoices, routeMapFlights, routeMapTotals, type Airport } from "@cielo/core";
import { API_URL } from "../../src/api";
import { Glass, Row, Txt } from "../../src/components/ui";
import { lookupAirport } from "../../src/airports";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

/** Every route flown, drawn as great circles, with the airports sized by visits. */
export default function RoutesMap() {
  const { t, flights, locale, pilot } = useApp();
  const c = useTheme();
  const [sel, setSel] = useState<{ a: Airport; n: number } | null>(null);
  const [period, setPeriod] = useState("all");
  const [type, setType] = useState("");
  const [sharing, setSharing] = useState(false);
  const choices = useMemo(() => routeMapChoices(flights), [flights]);
  const totals = useMemo(() => routeMapTotals(routeMapFlights(flights, { period, type }), lookupAirport), [flights, period, type]);

  const data = useMemo(() => {
    const routes = totals.routes.flatMap((r) => {
      const a = lookupAirport(r.a);
      const b = lookupAirport(r.b);
      return a && b ? [{ a, b, n: r.n }] : [];
    });
    const visits = [...totals.visits.entries()].flatMap(([icao, n]) => {
      const a = lookupAirport(icao);
      return a ? [{ a, n }] : [];
    });
    const pts = visits.map((v) => v.a);
    const region = pts.length
      ? (() => {
          const lats = pts.map((p) => p.lat);
          const lons = pts.map((p) => p.lon);
          const [s, n, w, e] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
          return { latitude: (s + n) / 2, longitude: (w + e) / 2, latitudeDelta: Math.min(120, Math.max(2, (n - s) * 1.3)), longitudeDelta: Math.min(300, Math.max(2, (e - w) * 1.3)) };
        })()
      : { latitude: 46.5, longitude: 2.5, latitudeDelta: 12, longitudeDelta: 12 };
    return { routes, visits, region };
  }, [totals]);

  /** The map as an image (drawn by geardown.app from the routes and totals), in the iOS share sheet. */
  const share = async () => {
    setSharing(true);
    try {
      const lang = locale === "fr" ? "fr" : "en";
      const per = period === "all" ? "" : period === "12m" ? t("map.last12") : period;
      const q = new URLSearchParams({ type: "map", lang, r: encodeShareRoutes(totals.routes), fl: String(totals.flights), ap: String(totals.airports), nm: String(totals.nm), ct: String(totals.countries), per, ty: type, name: pilot.fullName ?? "", rank: pilot.rank ?? "" });
      const r = await fetch(`${API_URL}/api/share-card?${q}`);
      if (!r.ok) throw new Error(String(r.status));
      const file = new File(Paths.cache, "geardown-map.png");
      if (file.exists) file.delete();
      file.create();
      file.write(new Uint8Array(await r.arrayBuffer()));
      await Share.share({ url: file.uri, message: `${t("map.shareText", { fl: totals.flights.toLocaleString(), ap: totals.airports, nm: totals.nm.toLocaleString(), ct: totals.countries })} · ${shareLinkUrl(API_URL, lang, q)}` });
    } catch {
      Alert.alert(t("badges.shareError"));
    } finally {
      setSharing(false);
    }
  };
  const chips: { v: string; l: string; on: boolean; press: () => void }[] = [
    { v: "all", l: t("map.all"), on: period === "all", press: () => setPeriod("all") },
    { v: "12m", l: t("map.last12"), on: period === "12m", press: () => setPeriod("12m") },
    ...choices.years.map((y) => ({ v: y, l: y, on: period === y, press: () => setPeriod(y) })),
    ...(choices.types.length > 1 ? choices.types.map((x) => ({ v: `t-${x}`, l: `✈ ${x}`, on: type === x, press: () => setType(type === x ? "" : x) })) : []),
  ];
  const stats = [
    { v: totals.flights, l: t("map.flights") },
    { v: totals.airports, l: t("map.airports") },
    { v: totals.nm, l: t("map.nm") },
    { v: totals.countries, l: t("map.countries") },
  ];

  const max = Math.max(1, ...data.visits.map((v) => v.n));
  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={data.region} userInterfaceStyle={c.scheme} onPress={() => setSel(null)}>
        {data.routes.map((r) => (
          <Polyline
            key={`${r.a.icao}-${r.b.icao}`}
            coordinates={[{ latitude: r.a.lat, longitude: r.a.lon }, { latitude: r.b.lat, longitude: r.b.lon }]}
            geodesic
            strokeColor={c.accent}
            strokeWidth={Math.min(5, 1.5 + Math.log2(r.n))}
          />
        ))}
        {data.visits.map((v) => {
          const d = 8 + Math.round((v.n / max) * 10);
          return (
            <Marker
              key={v.a.icao}
              coordinate={{ latitude: v.a.lat, longitude: v.a.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={(e) => {
                e.stopPropagation();
                setSel({ a: v.a, n: v.n });
              }}
            >
              <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: c.accent, borderWidth: 2, borderColor: "#fff" }} />
            </Marker>
          );
        })}
      </MapView>
      <View style={styles.top}>
        <Glass strong radius={16}>
          <View style={{ padding: 10, gap: 8 }}>
            <Row style={{ alignItems: "center", gap: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
                {chips.map((x) => (
                  <Pressable key={x.v} onPress={x.press} style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: x.on ? c.accent : "transparent", borderWidth: 1, borderColor: x.on ? c.accent : c.scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(10,22,38,0.15)" }}>
                    <Txt style={{ fontSize: 12.5, fontWeight: "700" }} color={x.on ? "#fff" : c.text}>{x.l}</Txt>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={() => void share()} disabled={sharing || !totals.flights} hitSlop={8} accessibilityLabel={t("map.share")} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: c.accent, opacity: totals.flights ? 1 : 0.4 }}>
                {sharing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="share-outline" size={17} color="#fff" />}
              </Pressable>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              {stats.map((x) => (
                <View key={x.l} style={{ flex: 1, alignItems: "center" }}>
                  <Txt mono style={{ fontSize: 17, fontWeight: "800" }}>{x.v.toLocaleString()}</Txt>
                  <Txt variant="small" style={{ fontSize: 11 }} numberOfLines={1}>{x.l}</Txt>
                </View>
              ))}
            </Row>
          </View>
        </Glass>
      </View>
      {sel ? (
        <View style={styles.bottom}>
          <Glass strong radius={18}>
            <Row style={{ padding: 14, justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Txt mono style={{ fontSize: 18, fontWeight: "700" }}>{sel.a.icao}</Txt>
                <Txt variant="small" numberOfLines={1}>{sel.a.name}</Txt>
              </View>
              <Txt mono>{t("map.visits", { n: sel.n })}</Txt>
            </Row>
          </Glass>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", top: 12, left: 12, right: 12 },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 100 },
});
