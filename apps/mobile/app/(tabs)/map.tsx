import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { Airport } from "@cielo/core";
import { Glass, Row, Txt } from "../../src/components/ui";
import { lookupAirport } from "../../src/airports";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

/** Every route flown, drawn as great circles, with the airports sized by visits. */
export default function RoutesMap() {
  const { t, flights } = useApp();
  const c = useTheme();
  const [sel, setSel] = useState<{ a: Airport; n: number } | null>(null);

  const data = useMemo(() => {
    const routes = new Map<string, { a: Airport; b: Airport; n: number }>();
    const visits = new Map<string, { a: Airport; n: number }>();
    for (const f of flights) {
      if (f.deletedAt || f.isFstd) continue;
      const a = lookupAirport(f.depIcao);
      const b = lookupAirport(f.arrIcao);
      for (const x of [a, b]) if (x) visits.set(x.icao, { a: x, n: (visits.get(x.icao)?.n ?? 0) + 1 });
      if (!a || !b || a.icao === b.icao) continue;
      const k = [a.icao, b.icao].sort().join("-");
      routes.set(k, { a, b, n: (routes.get(k)?.n ?? 0) + 1 });
    }
    const pts = [...visits.values()].map((v) => v.a);
    const region = pts.length
      ? (() => {
          const lats = pts.map((p) => p.lat);
          const lons = pts.map((p) => p.lon);
          const [s, n, w, e] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
          return { latitude: (s + n) / 2, longitude: (w + e) / 2, latitudeDelta: Math.min(120, Math.max(2, (n - s) * 1.3)), longitudeDelta: Math.min(300, Math.max(2, (e - w) * 1.3)) };
        })()
      : { latitude: 46.5, longitude: 2.5, latitudeDelta: 12, longitudeDelta: 12 };
    return { routes: [...routes.values()], visits: [...visits.values()], region };
  }, [flights]);

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
      <View style={styles.top} pointerEvents="none">
        <Glass strong radius={14}>
          <Txt variant="small" style={{ padding: 10 }}>
            {t("map.summary", { r: data.routes.length, a: data.visits.length })}
          </Txt>
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
