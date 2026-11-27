import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { usePrompt } from "../src/components/TextPrompt";
import { Stack, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LIVE_STEPS, formatDuration, goAround, liveMinutes, nextStep, setStepClock, shiftLast, stampStep, type LiveFlight, type LiveStep } from "@cielo/core";
import { AircraftPicker, aircraftLabel } from "../src/components/AircraftPicker";
import { Button, Card, Row, Txt, tap } from "../src/components/ui";
import type { I18nKey } from "../src/i18n";
import { airportHere, loadLive, locationAllowed, saveLive, type HereResult } from "../src/liveFlight";
import { lookupAirport } from "../src/airports";
import { useApp } from "../src/state";
import { space, useTheme } from "../src/theme";

const clock = (iso?: string) => (iso ? iso.slice(11, 16) : "--:--");

/**
 * "I'm flying now": one big button stamps off-block, take-off, landing and on-block in UTC; the airports come
 * from the phone's position at off-block and on-block (else the roster). Kept on the phone until the flight is
 * saved from the usual flight form, filled in.
 */
export default function LiveFlightScreen() {
  const prompt = usePrompt();
  const { t, store, flights, aircraft, aircraftTypes, rosterEvents, pilot } = useApp();
  const c = useTheme();
  const [f, setF] = useState<LiveFlight | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  // what the phone's position gave, said on screen (refused, no signal, no airport near)
  const [gps, setGps] = useState<HereResult | null>(null);

  // the flight in progress, or a new one prepared from the roster (a duty around now) and the last flight
  useEffect(() => {
    void (async () => {
      const saved = await loadLive(store);
      // iOS asks for the position now, before the first tap, not in the middle of a step
      if (!saved?.out) {
        const p = await locationAllowed();
        if (!p.granted) setGps({ status: "denied", canAskAgain: p.canAskAgain });
      }
      if (saved) return setF(saved);
      const nowMs = Date.now();
      const duty = rosterEvents
        .filter((e) => !e.deletedAt && e.kind === "FLIGHT" && !e.flightId && Math.abs(Date.parse(e.startUtc) - nowMs) < 4 * 3600_000)
        .sort((a, b) => Math.abs(Date.parse(a.startUtc) - nowMs) - Math.abs(Date.parse(b.startUtc) - nowMs))[0];
      const last = flights.find((x) => !x.isFstd && !x.deletedAt);
      const reg = duty?.aircraftReg?.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const ac = (reg && aircraft.find((a) => !a.deletedAt && a.registration.toUpperCase().replace(/[^A-Z0-9]/g, "") === reg)) || (last?.aircraftId ? aircraft.find((a) => a.id === last.aircraftId) : undefined);
      const fresh: LiveFlight = {
        startedAt: new Date().toISOString(),
        depIcao: duty?.depIcao ?? last?.arrIcao ?? pilot.homeBaseIcao ?? undefined,
        depFrom: duty?.depIcao ? "roster" : "last",
        arrIcao: duty?.arrIcao,
        arrFrom: duty?.arrIcao ? "roster" : undefined,
        aircraftId: ac?.id ?? null,
        registration: ac?.registration ?? duty?.aircraftReg,
        flightNumber: duty?.flightNumber,
        rosterEventId: duty?.id,
      };
      setF(fresh);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const update = (next: LiveFlight) => {
    setF(next);
    void saveLive(store, next);
  };

  const step = f ? nextStep(f) : undefined;
  const press = async () => {
    if (!f || !step || busy) return;
    tap("medium");
    const stamped = stampStep(f, new Date());
    update(stamped);
    // the airport the phone is at, at off-block and on-block
    if (step === "out" || step === "in") await locate(stamped, step === "out" ? "dep" : "arr");
  };
  /** The airport the phone is at, for the departure (off-block) or the arrival (on-block). */
  const locate = async (base: LiveFlight, which: "dep" | "arr") => {
    setBusy(true);
    const here = await airportHere();
    setBusy(false);
    setGps(here);
    if (here.status === "ok") update(which === "dep" ? { ...base, depIcao: here.icao, depFrom: "gps" } : { ...base, arrIcao: here.icao, arrFrom: "gps" });
  };
  const km = (n?: number) => (n === undefined ? "" : n < 10 ? n.toFixed(1).replace(".", t("live.decimal")) : String(Math.round(n)));
  const gpsLine = !gps
    ? null
    : gps.status === "ok"
      ? t("live.gpsOk", { icao: gps.icao, km: km(gps.km) })
      : gps.status === "far"
        ? gps.nearest
          ? t("live.gpsFar", { icao: gps.nearest, km: km(gps.km) })
          : t("live.gpsNone")
        : gps.status === "denied"
          ? t("live.gpsDenied")
          : t("live.gpsUnavailable");

  const editClock = (s: LiveStep) => {
    if (!f?.[s] && s !== step) return;
    void prompt
      .ask({ title: t(`live.step.${s}` as I18nKey), message: t("live.editHint"), defaultValue: clock(f?.[s] ?? new Date().toISOString()), okLabel: t("common.ok"), cancelLabel: t("common.cancel"), keyboardType: "numbers-and-punctuation" })
      .then((v) => v && update(setStepClock(f!, s, v.trim())));
  };
  const editAirport = (which: "dep" | "arr") => {
    if (!f) return;
    void prompt
      .ask({ title: t(which === "dep" ? "live.dep" : "live.arr"), message: t("live.icaoHint"), defaultValue: (which === "dep" ? f.depIcao : f.arrIcao) ?? "", okLabel: t("common.ok"), cancelLabel: t("common.cancel"), autoCapitalize: "characters" })
      .then((v) => {
        const code = (v ?? "").trim().toUpperCase();
        if (!/^[A-Z0-9]{3,4}$/.test(code)) return;
        const icao = lookupAirport(code)?.icao ?? code;
        update(which === "dep" ? { ...f, depIcao: icao, depFrom: undefined } : { ...f, arrIcao: icao, arrFrom: undefined });
      });
  };
  const abandon = () =>
    Alert.alert(t("live.abandon"), t("live.abandonBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("live.abandonOk"), style: "destructive", onPress: () => void saveLive(store, null).then(() => router.back()) },
    ]);
  const finish = () => {
    if (!f?.out || !f.in) return;
    router.replace({
      pathname: "/flight/[id]",
      params: {
        id: "new",
        live: "1",
        liveDate: f.out.slice(0, 10),
        liveDep: f.depIcao ?? "",
        liveArr: f.arrIcao ?? "",
        liveOut: clock(f.out),
        liveOff: f.off ? clock(f.off) : "",
        liveOn: f.on ? clock(f.on) : "",
        liveIn: clock(f.in),
        liveAircraft: f.aircraftId ?? "",
        liveReg: f.registration ?? "",
        liveNumber: f.flightNumber ?? "",
        liveTg: String(f.touchAndGos ?? 0),
        ...(f.rosterEventId ? { rosterEventId: f.rosterEventId } : {}),
      },
    });
  };

  const ac = useMemo(() => (f?.aircraftId ? aircraft.find((a) => a.id === f.aircraftId) : undefined), [f?.aircraftId, aircraft]);
  if (!f) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const flightMin = liveMinutes(f.off, f.on, now);
  const blockMin = liveMinutes(f.out, f.in, now);
  const from = (k?: string) => (k ? t(`live.from.${k}` as I18nKey) : "");
  const airportName = (icao?: string) => (icao ? lookupAirport(icao)?.name ?? "" : "");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: step ? t("live.title") : t("live.done") }} />
      {prompt.node}
      <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={() => setPicker(true)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Ionicons name="airplane" size={14} color={c.muted} />
          <Txt variant="small" numberOfLines={1}>{[ac ? aircraftLabel(ac, aircraftTypes) : f.registration || t("live.pickAircraft"), f.flightNumber].filter(Boolean).join(" · ")}</Txt>
          <Ionicons name="chevron-down" size={12} color={c.muted} />
        </Pressable>
        <Pressable onPress={abandon} hitSlop={10} accessibilityLabel={t("live.abandon")}>
          <Ionicons name="close" size={20} color={c.muted} />
        </Pressable>
      </Row>

      <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={() => editAirport("dep")} style={{ flex: 1 }}>
          <Txt style={{ fontSize: 28, fontWeight: "800" }}>{f.depIcao ?? "----"}</Txt>
          <Txt variant="small" numberOfLines={1}>{[airportName(f.depIcao), from(f.depFrom)].filter(Boolean).join(" · ")}</Txt>
        </Pressable>
        <Ionicons name="arrow-forward" size={22} color={c.muted} />
        <Pressable onPress={() => editAirport("arr")} style={{ flex: 1, alignItems: "flex-end" }}>
          <Txt style={{ fontSize: 28, fontWeight: "800" }}>{f.arrIcao ?? "----"}</Txt>
          <Txt variant="small" numberOfLines={1} style={{ textAlign: "right" }}>{[airportName(f.arrIcao), from(f.arrFrom)].filter(Boolean).join(" · ")}</Txt>
        </Pressable>
      </Row>

      {gpsLine ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, backgroundColor: gps?.status === "ok" ? c.accent + "1A" : c.surface }}>
          <Ionicons name={gps?.status === "ok" ? "locate" : "warning-outline"} size={16} color={gps?.status === "ok" ? c.accent : c.warning} />
          <Txt variant="small" style={{ flex: 1 }}>{gpsLine}</Txt>
          {gps?.status === "denied" ? (
            <Button kind="secondary" small title={t("live.openSettings")} onPress={() => void Linking.openSettings()} />
          ) : gps?.status !== "ok" && (f.out || f.in) ? (
            <Button kind="secondary" small title={t("live.retry")} onPress={() => void locate(f, f.in ? "arr" : "dep")} />
          ) : null}
        </View>
      ) : null}

      <Card style={{ alignItems: "center", gap: 2 }}>
        <Txt variant="small">{f.off ? t("live.flightTime") : t("live.blockTime")}</Txt>
        <Txt mono style={{ fontSize: 56, fontWeight: "800", lineHeight: 64 }}>{formatDuration(f.off ? flightMin : blockMin)}</Txt>
        <Txt variant="small">{[f.off ? `${t("live.block")} ${formatDuration(blockMin)}` : "", `UTC ${now.toISOString().slice(11, 16)}`].filter(Boolean).join(" · ")}</Txt>
      </Card>

      <Row gap={8}>
        {LIVE_STEPS.map((s) => {
          const done = !!f[s];
          const isNext = s === step;
          return (
            <Pressable
              key={s}
              onPress={() => editClock(s)}
              style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderStyle: isNext ? "dashed" : "solid", borderColor: done ? c.accent + "88" : isNext ? c.muted : "transparent" }}
            >
              <Txt variant="label" numberOfLines={1} style={{ fontSize: 10 }}>{t(`live.step.${s}` as I18nKey)}</Txt>
              <Txt mono style={{ fontSize: 17, fontWeight: "700", marginTop: 2 }} color={done ? c.accent : c.muted}>{clock(f[s])}</Txt>
            </Pressable>
          );
        })}
      </Row>

      {step ? (
        <>
          <Pressable
            onPress={() => void press()}
            accessibilityRole="button"
            accessibilityLabel={t(`live.step.${step}` as I18nKey)}
            style={({ pressed }) => ({
              alignSelf: "center",
              marginTop: 8,
              width: 168,
              height: 168,
              borderRadius: 84,
              backgroundColor: c.accent,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 12,
              borderColor: c.accent + "33",
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Txt style={{ fontSize: 19, fontWeight: "800", textAlign: "center" }} color={c.onAccent}>{t(`live.step.${step}` as I18nKey)}</Txt>
            <Txt style={{ fontSize: 12, fontWeight: "600" }} color={c.onAccent}>{busy ? t("live.locating") : t("live.tap")}</Txt>
          </Pressable>
          <Row style={{ justifyContent: "center", flexWrap: "wrap" }} gap={8}>
            {f.out ? <Button kind="secondary" small title={t("live.minus")} onPress={() => update(shiftLast(f, -1))} /> : null}
            {f.on && !f.in ? <Button kind="secondary" small title={t("live.goAround")} onPress={() => update(goAround(f))} /> : null}
          </Row>
          {f.touchAndGos ? <Txt variant="small" style={{ textAlign: "center" }}>{t("live.tg", { n: f.touchAndGos })}</Txt> : null}
          <Txt variant="small" style={{ textAlign: "center" }}>{t("live.kept")}</Txt>
        </>
      ) : (
        <>
          <Card style={{ gap: 8 }}>
            {[
              [t("live.sumBlock"), formatDuration(blockMin)],
              [t("live.sumFlight"), f.off && f.on ? formatDuration(flightMin) : "—"],
              [t("live.sumArr"), f.arrFrom === "gps" ? `GPS · ${f.arrIcao}` : f.arrIcao ?? "—"],
            ].map(([k, v]) => (
              <Row key={k} style={{ justifyContent: "space-between" }}>
                <Txt>{k}</Txt>
                <Txt mono style={{ fontWeight: "700" }}>{v}</Txt>
              </Row>
            ))}
          </Card>
          <Button title={t("live.save")} onPress={finish} />
          <Txt variant="small" style={{ textAlign: "center" }}>{t("live.saveHint")}</Txt>
        </>
      )}

      <AircraftPicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(a) => {
          update({ ...f, aircraftId: a.id, registration: a.registration });
          setPicker(false);
        }}
      />
    </ScrollView>
  );
}
