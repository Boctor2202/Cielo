import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Glass, Row, Txt } from "../../src/components/ui";
import { api, ApiError, type LiveAircraft, type Track } from "../../src/api";
import * as Location from "expo-location";
import { airports, lookupAirport } from "../../src/airports";
import { AirportWeather, fetchRunways } from "../../src/components/Weather";
import { classifyRunwayUse, RunwayUseTracker, runwayUseLabel, type Airport, type RunwayThreshold, type RunwayUseSummary } from "@cielo/core";
import { API_URL } from "../../src/api";
import { useApp } from "../../src/state";
import { Requires } from "../../src/components/Access";
import { font, useTheme } from "../../src/theme";

const POLL_MS = 15_000;
const NM = 1852;

function altColor(alt: LiveAircraft["alt"]) {
  if (alt === "ground" || alt == null) return "#9aa5b1";
  if (alt < 2000) return "#22c55e";
  if (alt < 10000) return "#eab308";
  if (alt < 20000) return "#f97316";
  if (alt < 30000) return "#38bdf8"; // altitude scale (data colours), not the brand accent
  return "#a78bfa";
}

/** Live traffic (adsb.lol through the Geardown API) on Apple Maps / Google Maps, with the selected aircraft's track. */
export default function Radar() {
  return (
    <Requires feature="radar">
      <RadarScreen />
    </Requires>
  );
}

let runwayData: Promise<Record<string, RunwayThreshold[]>> | null = null;
/** Runway thresholds (OurAirports), fetched once from the website (about 480 KB). */
const loadRunways = () =>
  (runwayData ??= fetch(`${API_URL}/data/runways.json`)
    .then((r) => r.json())
    .then((d: { airports: Record<string, [string, number, number, number | null, number | null][]> }) => {
      const out: Record<string, RunwayThreshold[]> = {};
      for (const [icao, ends] of Object.entries(d.airports)) {
        const ok = ends.filter((e) => e[3] != null && e[4] != null).map(([ident, headingTrue, lengthFt, lat, lon]) => ({ ident, headingTrue, lengthFt, lat: lat!, lon: lon! }));
        if (ok.length) out[icao] = ok;
      }
      return out;
    })
    .catch(() => {
      runwayData = null;
      return {} as Record<string, RunwayThreshold[]>;
    }));

function RadarScreen() {
  const { t, flights, pilot } = useApp();
  const c = useTheme();
  const map = useRef<MapView>(null);
  // start on the home base (else Paris) until the position is known
  const base = pilot.homeBaseIcao ? lookupAirport(pilot.homeBaseIcao) : undefined;
  const region = useRef<Region>({ latitude: base?.lat ?? 48.7, longitude: base?.lon ?? 2.4, latitudeDelta: 2, longitudeDelta: 2 });
  const [located, setLocated] = useState(false);
  const locate = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    const last = await Location.getLastKnownPositionAsync();
    const p = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    setLocated(true);
    map.current?.animateToRegion({ latitude: p.coords.latitude, longitude: p.coords.longitude, latitudeDelta: 1.6, longitudeDelta: 1.6 }, 600);
  }, []);
  useEffect(() => {
    void locate();
  }, [locate]);
  const [ac, setAc] = useState<LiveAircraft[]>([]);
  const [sel, setSel] = useState<LiveAircraft | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "quota" | "error">("loading");
  const [q, setQ] = useState("");
  const [notFound, setNotFound] = useState("");
  const selHex = useRef<string | null>(null);
  selHex.current = sel?.hex ?? null;
  const [showAirports, setShowAirports] = useState(true);
  const [fields, setFields] = useState<Airport[]>([]);
  const [apt, setApt] = useState<Airport | null>(null);
  const [rwy, setRwy] = useState<Record<string, string>>({});
  const tracker = useRef(new RunwayUseTracker());
  const [seen, setSeen] = useState<Record<string, string>>({});
  // every traffic update: aircraft low near a larger aerodrome, lined up with one of its runways
  useEffect(() => {
    let alive = true;
    const low = ac.filter((a) => typeof a.alt === "number" && a.alt < 9000 && a.trk != null);
    if (!low.length) return;
    void loadRunways().then((rwys) => {
      if (!alive) return;
      const near = airports().list.filter((f) => (f.size ?? 1) >= 2 && rwys[f.icao] && low.some((a) => Math.abs(a.lat - f.lat) < 0.25 && Math.abs(a.lon - f.lon) < 0.4));
      const touched = new Set<string>();
      for (const a of low)
        for (const f of near) {
          if (Math.abs(a.lat - f.lat) > 0.25 || Math.abs(a.lon - f.lon) > 0.4) continue;
          const use = classifyRunwayUse({ hex: a.hex, lat: a.lat, lon: a.lon, alt: a.alt, trk: a.trk, gs: a.gs, vr: a.vr }, f.elevationFt ?? 0, rwys[f.icao]!);
          if (use) {
            tracker.current.observe(f.icao, a.hex, use);
            touched.add(f.icao);
          }
        }
      if (touched.size)
        setSeen((cur) => {
          const next = { ...cur };
          for (const i of touched) next[i] = runwayUseLabel(tracker.current.summary(i));
          return next;
        });
    });
    return () => {
      alive = false;
    };
  }, [ac]);
  const labelOf = (icao: string) => (seen[icao] ? `${icao} ${seen[icao]}` : rwy[icao] ? `${icao} ≈${rwy[icao]}` : icao);
  /** Airports in view: large ones when zoomed out, medium, then every aerodrome closer in. */
  const placeAirports = useCallback((r: Region) => {
    const span = Math.max(r.latitudeDelta, r.longitudeDelta);
    const min = span > 14 ? 4 : span > 3 ? 3 : span > 0.9 ? 2 : 1;
    if (min > 3) return setFields([]);
    const [s, n] = [r.latitude - r.latitudeDelta / 2, r.latitude + r.latitudeDelta / 2];
    const [w, e] = [r.longitude - r.longitudeDelta / 2, r.longitude + r.longitudeDelta / 2];
    const out: Airport[] = [];
    for (const a of airports().list) {
      if ((a.size ?? 1) < min || a.lat < s || a.lat > n || a.lon < w || a.lon > e) continue;
      out.push(a);
      if (out.length >= 150) break;
    }
    setFields(out);
    // runway the wind favours, for the larger aerodromes in view
    const ids = out.filter((a) => (a.size ?? 1) >= 2).sort((a, b) => (b.size ?? 0) - (a.size ?? 0)).slice(0, 40).map((a) => a.icao);
    if (ids.length)
      void fetchRunways(ids).then((r) => {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) if (!v.calm) next[k] = v.ident;
        setRwy((cur) => ({ ...cur, ...next }));
      });
  }, []);
  useEffect(() => placeAirports(region.current), [placeAirports]);

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
        showsUserLocation={located}
        onRegionChangeComplete={(r) => {
          region.current = r;
          placeAirports(r);
          void refresh();
        }}
        onPress={() => {
          setSel(null);
          setApt(null);
        }}
      >
        {showAirports
          ? fields.map((a) => (
              <Marker key={`apt-${a.icao}-${labelOf(a.icao)}`} coordinate={{ latitude: a.lat, longitude: a.lon }} anchor={{ x: 0.5, y: 0.25 }} tracksViewChanges={false}
                zIndex={0}
                onPress={(e) => {
                  e.stopPropagation();
                  setSel(null);
                  setApt(a);
                }}
              >
                <View style={{ alignItems: "center" }}>
                  <View style={{ width: a.size === 3 ? 10 : 8, height: a.size === 3 ? 10 : 8, borderRadius: 5, borderWidth: 1.6, borderColor: c.text, backgroundColor: c.scheme === "dark" ? "#0a1626" : "#ffffff" }} />
                  <Txt style={{ fontSize: 10, fontWeight: "600", textShadowColor: c.scheme === "dark" ? "#0a1626" : "#ffffff", textShadowRadius: 3 }}>{labelOf(a.icao)}</Txt>
                </View>
              </Marker>
            ))
          : null}
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
              style={{ flex: 1, color: c.text, ...font.regular, fontSize: 15 }}
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
        <Row style={{ flexWrap: "wrap", marginTop: 8 }} gap={6}>
          <Pressable onPress={() => void locate()}>
            <Glass strong radius={999}>
              <Row gap={4} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
                <Ionicons name="locate" size={13} color={c.accent} />
                <Txt style={{ fontSize: 12, fontWeight: "600" }}>{t("radar.locate")}</Txt>
              </Row>
            </Glass>
          </Pressable>
          <Pressable onPress={() => setShowAirports((v) => !v)} accessibilityState={{ selected: showAirports }}>
            <Glass strong radius={999}>
              <Txt style={{ paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "600" }} color={showAirports ? c.accent : c.muted}>{t("radar.airports")}</Txt>
            </Glass>
          </Pressable>
        </Row>
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

      {apt && !sel ? (
        <View style={styles.bottom}>
          <Glass strong radius={20}>
            <View style={{ padding: 16, gap: 10 }}>
              <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Txt mono style={{ fontSize: 20, fontWeight: "700" }}>{apt.icao}</Txt>
                  <Txt variant="small" numberOfLines={1}>{apt.name}</Txt>
                </View>
                <Pressable onPress={() => setApt(null)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={c.muted} />
                </Pressable>
              </Row>
              <TrafficRunways summary={tracker.current.summary(apt.icao)} />
              <AirportWeather icao={apt.icao} compact />
            </View>
          </Glass>
        </View>
      ) : null}
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

/** Runways the live traffic was seen landing on and taking off from (last 20 minutes). */
function TrafficRunways({ summary }: { summary: RunwayUseSummary | null }) {
  const { t } = useApp();
  const ago = (ms: number) => Math.max(0, Math.round((Date.now() - ms) / 60000));
  const row = (label: string, list: RunwayUseSummary["arr"]) =>
    list.length ? (
      <Row style={{ flexWrap: "wrap", columnGap: 8 }}>
        <Txt variant="small">{label}</Txt>
        {list.map((e) => (
          <Txt key={e.ident} variant="small">
            <Txt mono style={{ fontWeight: "800", fontSize: 15 }}>{e.ident}</Txt> {t("radar.rwySeen", { n: e.count, min: ago(e.lastAt) })}
          </Txt>
        ))}
      </Row>
    ) : null;
  return (
    <View style={{ gap: 3 }}>
      <Txt variant="label">{t("radar.rwyTraffic")}</Txt>
      {summary ? (
        <>
          {row(t("radar.rwyArr"), summary.arr)}
          {row(t("radar.rwyDep"), summary.dep)}
        </>
      ) : (
        <Txt variant="small">{t("radar.rwyNone")}</Txt>
      )}
    </View>
  );
}
