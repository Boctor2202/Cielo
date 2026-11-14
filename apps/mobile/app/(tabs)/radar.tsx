import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Glass, Row, Txt } from "../../src/components/ui";
import { api, ApiError, type LiveAircraft, type Track } from "../../src/api";
import { useApp } from "../../src/state";
import { font, useTheme } from "../../src/theme";

const POLL_MS = 15_000;
const NM = 1852;

function altColor(alt: LiveAircraft["alt"]) {
  if (alt === "ground" || alt == null) return "#9aa5b1";
  if (alt < 2000) return "#22c55e";
  if (alt < 10000) return "#eab308";
  if (alt < 20000) return "#f97316";
  if (alt < 30000) return "#22d3ee";
  return "#a78bfa";
}

/** Live traffic (adsb.lol through the Geardown API) on Apple Maps / Google Maps, with the selected aircraft's track. */
export default function Radar() {
  const { t, flights } = useApp();
  const c = useTheme();
  const map = useRef<MapView>(null);
  const region = useRef<Region>({ latitude: 48.7, longitude: 2.4, latitudeDelta: 3, longitudeDelta: 3 });
  const [ac, setAc] = useState<LiveAircraft[]>([]);
  const [sel, setSel] = useState<LiveAircraft | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "quota" | "error">("loading");
  const [q, setQ] = useState("");
  const [notFound, setNotFound] = useState("");
  const selHex = useRef<string | null>(null);
  selHex.current = sel?.hex ?? null;

  const myRegs = [...new Set(flights.filter((f) => !f.isFstd && f.registration).map((f) => f.registration!.toUpperCase()))].slice(0, 5);

  const refresh = useCallback(async () => {
    const r = region.current;
    const radius = Math.min(250, Math.max(25, Math.ceil(((Math.max(r.latitudeDelta, r.longitudeDelta) * 60) / 2 / 25)) * 25));
    try {
      const d = await api<{ ac: LiveAircraft[] }>(`/api/radar?lat=${Math.round(r.latitude * 2) / 2}&lon=${Math.round(r.longitude * 2) / 2}&r=${radius}`);
      setAc(d.ac);
      setStatus("ok");
      const now = selHex.current && d.ac.find((a) => a.hex === selHex.current);
      if (now) setSel(now);
    } catch (e) {
      setStatus(e instanceof ApiError && e.status === 429 ? "quota" : "error");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const i = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(i);
  }, [refresh]);

  useEffect(() => {
    setTrack(null);
    if (!sel?.hex) return;
    api<Track>(`/api/radar/trace?hex=${sel.hex}`).then(setTrack).catch(() => undefined);
  }, [sel?.hex]);

  const findReg = async (reg: string) => {
    const r = reg.trim().toUpperCase();
    if (r.length < 3) return;
    setNotFound("");
    try {
      const d = await api<{ ac: LiveAircraft[] }>(`/api/radar/reg?r=${encodeURIComponent(r)}`);
      const a = d.ac[0];
      if (!a) return setNotFound(r);
      setSel(a);
      map.current?.animateToRegion({ latitude: a.lat, longitude: a.lon, latitudeDelta: 2.5, longitudeDelta: 2.5 }, 600);
    } catch {
      setNotFound(r);
    }
  };

  const leg = track?.legs.at(-1);
  const fmtAlt = (a: LiveAircraft["alt"]) => (a === "ground" ? t("radar.ground") : a == null ? "—" : `${a.toLocaleString()} ft`);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={region.current}
        userInterfaceStyle={c.scheme}
        onRegionChangeComplete={(r) => {
          region.current = r;
          void refresh();
        }}
        onPress={() => setSel(null)}
      >
        {ac.map((a) => (
          <Marker
            key={a.hex}
            coordinate={{ latitude: a.lat, longitude: a.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={(e) => {
              e.stopPropagation();
              setSel(a);
            }}
          >
            <Ionicons name="airplane" size={sel?.hex === a.hex ? 26 : 18} color={sel?.hex === a.hex ? "#ffffff" : altColor(a.alt)} style={{ transform: [{ rotate: `${(a.trk ?? 0) - 90}deg` }] }} />
          </Marker>
        ))}
        {leg && sel ? (
          <Polyline coordinates={[...leg.map((p) => ({ latitude: p[1], longitude: p[2] })), { latitude: sel.lat, longitude: sel.lon }]} strokeColor={c.accent} strokeWidth={3} />
        ) : null}
      </MapView>

      <View style={styles.top} pointerEvents="box-none">
        <Glass strong radius={16}>
          <Row style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            <Ionicons name="search" size={16} color={c.muted} />
            <TextInput
              style={{ flex: 1, color: c.text, fontFamily: font.regular, fontSize: 15 }}
              placeholder={t("radar.searchReg")}
              placeholderTextColor={c.muted}
              autoCapitalize="characters"
              value={q}
              onChangeText={setQ}
              returnKeyType="search"
              onSubmitEditing={() => void findReg(q)}
            />
          </Row>
        </Glass>
        {myRegs.length ? (
          <Row style={{ flexWrap: "wrap", marginTop: 8 }} gap={6}>
            {myRegs.map((r) => (
              <Pressable key={r} onPress={() => void findReg(r)}>
                <Glass strong radius={999}>
                  <Txt style={{ paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "600" }}>{r}</Txt>
                </Glass>
              </Pressable>
            ))}
          </Row>
        ) : null}
        {notFound ? (
          <Glass strong radius={12} style={{ marginTop: 8 }}>
            <Txt variant="small" style={{ padding: 10 }}>{t("radar.notAirborne", { reg: notFound })}</Txt>
          </Glass>
        ) : null}
      </View>

      {sel ? (
        <View style={styles.bottom}>
          <Glass strong radius={20}>
            <View style={{ padding: 16, gap: 10 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <View>
                  <Txt mono style={{ fontSize: 20, fontWeight: "700" }}>{sel.cs ?? sel.r ?? sel.hex.toUpperCase()}</Txt>
                  <Txt variant="small">{[sel.r, track?.desc ?? sel.t].filter(Boolean).join(" · ")}</Txt>
                </View>
                <Pressable onPress={() => setSel(null)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={c.muted} />
                </Pressable>
              </Row>
              <Row gap={16}>
                <Item label={t("radar.altitude")} value={fmtAlt(sel.alt)} />
                <Item label={t("radar.speed")} value={sel.gs != null ? `${sel.gs} kt` : "—"} />
                <Item label={t("radar.vs")} value={sel.vr != null ? `${sel.vr > 0 ? "+" : ""}${sel.vr}` : "—"} />
              </Row>
              {leg ? <Txt variant="small">{t("radar.trackSince", { time: new Date(leg[0]![0] * 1000).toISOString().slice(11, 16) })}</Txt> : null}
            </View>
          </Glass>
        </View>
      ) : (
        <View style={styles.status} pointerEvents="none">
          <Glass strong radius={999}>
            <Row style={{ paddingHorizontal: 12, paddingVertical: 6 }} gap={6}>
              {status === "loading" ? <ActivityIndicator size="small" color={c.accent} /> : null}
              <Txt variant="small" color={status === "ok" ? c.text : c.warning}>
                {status === "ok" ? t("radar.count", { n: ac.length }) : status === "quota" ? t("radar.quota") : status === "error" ? t("radar.error") : "…"}
              </Txt>
            </Row>
          </Glass>
          <Txt variant="small" style={{ marginTop: 6, fontSize: 10 }}>{t("radar.attribution")}</Txt>
        </View>
      )}
    </View>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="small">{label}</Txt>
      <Txt mono style={{ fontSize: 16 }}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 12, right: 12, top: 12 },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 100 },
  status: { position: "absolute", left: 12, bottom: 100, alignItems: "flex-start" },
});
