import React, { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  APPROACH_TYPES,
  PILOT_FUNCTIONS,
  addDays,
  defaultIfrFor,
  deriveFlightTimes,
  formatClock,
  formatDuration,
  parseClock,
  parseDuration,
  type Approach,
  type Flight,
  type FlightFormInput,
  type OperationMode,
  type PilotFunction,
} from "@cielo/core";
import { AirportField } from "../../src/components/AirportField";
import { AircraftTypeField } from "../../src/components/AircraftTypeField";
import { AircraftPicker, aircraftLabel } from "../../src/components/AircraftPicker";
import { AircraftPhoto } from "../../src/components/AircraftPhoto";
import { FlightTrackCard } from "../../src/components/FlightTrack";
import { FlightSignature } from "../../src/components/FlightSignature";
import { DurationField, normDuration } from "../../src/components/DurationField";
import { Button, Card, Chip, Field, Row, Screen, Segmented, Stat, Stepper, ToggleRow, Txt, tap } from "../../src/components/ui";
import { lookupAirport } from "../../src/airports";
import type { I18nKey } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { Paywall } from "../../src/components/Access";
import { mono, space, useTheme } from "../../src/theme";

type Clock = "out" | "off" | "on" | "in";

interface FormState {
  date: string;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  out: string;
  off: string;
  on: string;
  in: string;
  aircraftId: string | null;
  /** type picked directly when no aircraft (registration) is chosen */
  typeIcao: string;
  /** null: the chosen aircraft's default */
  operation: OperationMode | null;
  function: PilotFunction;
  picName: string;
  ifr: boolean;
  pilotFlying: boolean;
  autoLandings: boolean;
  autoNight: boolean;
  nightManual: string;
  /** h:mm overrides; "" = automatic (IFR: whole block time; IMC / XC: none) */
  ifrManual: string;
  actualImc: string;
  xc: string;
  takeoffsDay: number;
  takeoffsNight: number;
  landingsDay: number;
  landingsNight: number;
  approaches: Approach[];
  isFstd: boolean;
  fstdType: string;
  fstdQualification: string;
  fstdMin: string;
  remarks: string;
}

const nowClock = () => formatClock(new Date().toISOString());
const normClock = (s: string) => {
  const c = parseClock(s);
  return c ? `${String(c.h).padStart(2, "0")}:${String(c.m).padStart(2, "0")}` : s.trim() === "" ? "" : s;
};

export default function FlightFormRoute() {
  const { access } = useApp();
  // read-only without a live subscription: viewing stays possible from the lists, editing does not
  if (!access.canWrite) return <Paywall />;
  return <FlightForm />;
}

function FlightForm() {
  const { id, rosterEventId } = useLocalSearchParams<{ id: string; rosterEventId?: string }>();
  const { t, flights, aircraft, aircraftTypes, rosterEvents, pilot, put } = useApp();
  const c = useTheme();
  const existing = id && id !== "new" ? flights.find((f) => f.id === id) : undefined;
  const rosterEvent = rosterEventId ? rosterEvents.find((e) => e.id === rosterEventId) : undefined;

  const [form, setForm] = useState<FormState>(() => initialState(existing, rosterEvent));
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  function initialState(f: Flight | undefined, ev: typeof rosterEvent): FormState {
    if (f) {
      return {
        date: f.date,
        flightNumber: f.flightNumber ?? "",
        depIcao: f.depIcao,
        arrIcao: f.arrIcao,
        out: formatClock(f.outUtc),
        off: formatClock(f.offUtc),
        on: formatClock(f.onUtc),
        in: formatClock(f.inUtc),
        aircraftId: f.aircraftId ?? null,
        typeIcao: f.aircraftId ? "" : (f.aircraftTypeIcao ?? ""),
        operation: f.multiPilotMin > 0 ? "multi_pilot" : "single_pilot",
        function: f.function,
        picName: f.picName ?? "",
        ifr: f.ifrMin > 0,
        pilotFlying: f.pilotFlying,
        autoLandings: false,
        autoNight: f.nightCalc !== "manual",
        nightManual: f.nightCalc === "manual" ? formatDuration(f.nightMin) : "",
        // same rule as the web (flightToInput): an IFR time that differs from block time was entered by hand
        ifrManual: f.ifrMin > 0 && f.ifrMin !== f.totalMin ? formatDuration(f.ifrMin) : "",
        actualImc: f.actualImcMin ? formatDuration(f.actualImcMin) : "",
        xc: f.xcMin ? formatDuration(f.xcMin) : "",
        takeoffsDay: f.takeoffsDay,
        takeoffsNight: f.takeoffsNight,
        landingsDay: f.landingsDay,
        landingsNight: f.landingsNight,
        approaches: f.approaches ?? [],
        isFstd: f.isFstd,
        fstdType: f.fstdType ?? "",
        fstdQualification: f.fstdQualification ?? "",
        fstdMin: f.fstdMin ? formatDuration(f.fstdMin) : "",
        remarks: f.remarks ?? "",
      };
    }
    const last = flights.find((x) => !x.isFstd);
    const pf = pilot.defaultPilotFlying === "always" ? true : pilot.defaultPilotFlying === "never" ? false : !(last?.pilotFlying ?? false);
    const ac = ev?.aircraftReg ? aircraft.find((a) => a.registration === ev.aircraftReg) : last ? aircraft.find((a) => a.id === last.aircraftId) : undefined;
    const type = ac ? aircraftTypes.find((x) => x.id === ac.aircraftTypeId) : undefined;
    return {
      date: ev ? ev.startUtc.slice(0, 10) : todayUtc(),
      flightNumber: ev?.flightNumber ?? "",
      depIcao: ev?.depIcao ?? last?.arrIcao ?? pilot.homeBaseIcao ?? "",
      arrIcao: ev?.arrIcao ?? "",
      out: ev ? formatClock(ev.startUtc) : "",
      off: "",
      on: "",
      in: ev ? formatClock(ev.endUtc) : "",
      aircraftId: ac?.id ?? null,
      typeIcao: "",
      operation: null,
      function: pilot.defaultFunction,
      picName: "",
      ifr: defaultIfrFor(pilot.defaultIfr, type),
      pilotFlying: pf,
      autoLandings: true,
      autoNight: true,
      nightManual: "",
      ifrManual: "",
      actualImc: "",
      xc: "",
      takeoffsDay: 0,
      takeoffsNight: 0,
      landingsDay: 0,
      landingsNight: 0,
      approaches: [],
      isFstd: ev?.kind === "SIM",
      fstdType: ev?.kind === "SIM" ? (ev.aircraftTypeIcao ?? "") : "",
      fstdQualification: "",
      fstdMin: "",
      remarks: "",
    };
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }));

  const selectedAircraft = aircraft.find((a) => a.id === form.aircraftId);
  const selectedType = selectedAircraft
    ? aircraftTypes.find((x) => x.id === selectedAircraft.aircraftTypeId)
    : form.typeIcao
      ? aircraftTypes.find((x) => x.icao.toUpperCase() === form.typeIcao.toUpperCase())
      : undefined;

  const input: FlightFormInput = useMemo(
    () => ({
      date: form.date,
      flightNumber: form.flightNumber || undefined,
      depIcao: form.depIcao,
      arrIcao: form.arrIcao,
      out: form.out || undefined,
      off: form.off || undefined,
      on: form.on || undefined,
      in: form.in || undefined,
      aircraftId: form.aircraftId,
      registration: selectedAircraft?.registration,
      aircraftTypeIcao: selectedType?.icao ?? (form.typeIcao || undefined),
      aircraftModel: selectedType ? `${selectedType.manufacturer} ${selectedType.model}` : undefined,
      operation: form.operation ?? selectedAircraft?.defaultOperation ?? (selectedType?.multiPilot ? "multi_pilot" : undefined),
      function: form.function,
      picName: form.picName || undefined,
      ifr: form.ifr,
      nightOverrideMin: form.autoNight ? undefined : (parseDuration(normDuration(form.nightManual)) ?? 0),
      // the override only applies to an IFR flight (the web disables it otherwise)
      ifrOverrideMin: form.ifr ? (parseDuration(normDuration(form.ifrManual)) ?? undefined) : undefined,
      actualImcMin: parseDuration(normDuration(form.actualImc)) ?? undefined,
      xcMin: parseDuration(normDuration(form.xc)) ?? undefined,
      takeoffsDay: form.takeoffsDay,
      takeoffsNight: form.takeoffsNight,
      landingsDay: form.landingsDay,
      landingsNight: form.landingsNight,
      autoLandings: form.autoLandings,
      pilotFlying: form.pilotFlying,
      approaches: form.approaches.filter((a) => a.type.trim() && a.count > 0),
      isFstd: form.isFstd,
      fstdType: form.fstdType || undefined,
      fstdQualification: form.fstdQualification || undefined,
      fstdMin: parseDuration(normDuration(form.fstdMin)) ?? 0,
      remarks: form.remarks || undefined,
    }),
    [form, selectedAircraft, selectedType],
  );

  const derived = useMemo(
    () => deriveFlightTimes(input, { airports: lookupAirport, aircraftType: selectedType, aircraft: selectedAircraft }),
    [input, selectedType, selectedAircraft],
  );
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);
  const locked = !!existing?.locked;
  // what the collapsed "advanced times" header shows: only the values the pilot entered
  const advancedSummary = [
    input.ifrOverrideMin !== undefined ? `${t("flight.ifrTime")} ${formatDuration(input.ifrOverrideMin)}` : "",
    input.actualImcMin ? `IMC ${formatDuration(input.actualImcMin)}` : "",
    input.xcMin ? `XC ${formatDuration(input.xcMin)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || Number.isNaN(Date.parse(form.date))) return setError(t("flight.invalidDate"));
    if (!form.isFstd && (!form.depIcao.trim() || !form.arrIcao.trim())) return setError(t("flight.invalidAirports"));
    setError(null);
    setSaving(true);
    try {
      const { warnings: _w, ...times } = derived;
      const flight: Partial<Flight> = {
        ...existing,
        pilotId: pilot.id,
        date: input.date,
        flightNumber: input.flightNumber,
        source: existing?.source ?? (rosterEvent ? "roster" : "manual"),
        rosterEventId: existing?.rosterEventId ?? rosterEvent?.id ?? null,
        depIcao: input.depIcao.toUpperCase(),
        arrIcao: input.arrIcao.toUpperCase(),
        aircraftId: input.aircraftId ?? null,
        registration: input.registration,
        aircraftTypeIcao: input.aircraftTypeIcao,
        aircraftModel: input.aircraftModel,
        ...times,
        function: input.function,
        picName: input.picName ?? (input.function === "PIC" ? "SELF" : undefined),
        // capped at block time, as the web's buildFlight does (FSTD: block time is 0)
        actualImcMin: Math.min(input.actualImcMin ?? 0, times.totalMin),
        xcMin: Math.min(input.xcMin ?? 0, times.totalMin),
        pilotFlying: input.pilotFlying,
        approaches: input.approaches ?? [],
        isFstd: input.isFstd,
        fstdType: input.isFstd ? input.fstdType : undefined,
        fstdQualification: input.isFstd ? input.fstdQualification : undefined,
        fstdMin: input.isFstd ? (input.fstdMin ?? 0) : 0,
        crew: existing?.crew ?? [],
        remarks: input.remarks,
        signatureId: existing?.signatureId ?? null,
        locked: existing?.locked ?? false,
      };
      const saved = await put("flights", flight);
      if (rosterEvent && !rosterEvent.flightId) await put("roster_events", { ...rosterEvent, flightId: saved.id });
      router.back();
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error && e.message === "read_only" ? t("access.readOnlyBanner") : e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const clockField = (k: Clock, label: I18nKey) => (
    <View style={{ flex: 1, gap: 4 }}>
      <Field
        label={t(label)}
        value={form[k]}
        monoValue
        placeholder="--:--"
        keyboardType="number-pad"
        maxLength={5}
        // digits only on the keypad: "0830" becomes "08:30" as it is typed
        onChangeText={(s) => {
          const d = s.replace(/\D/g, "").slice(0, 4);
          set(k, d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
        }}
        onBlur={() => {
          // three digits ("830") mean 08:30
          const d = form[k].replace(/\D/g, "");
          set(k, normClock(d.length === 3 ? `0${d[0]}:${d.slice(1)}` : form[k]));
        }}
        error={!!form[k] && !parseClock(form[k])}
      />
      <Pressable onPress={() => (tap(), set(k, nowClock()))} hitSlop={6}>
        <Txt variant="small" color={c.accent}>
          {t("common.now")}
        </Txt>
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          title: existing ? t("flight.edit") : t("flight.new"),
          headerRight: () => <Button kind="ghost" small title={t("common.save")} onPress={save} disabled={locked} loading={saving} />,
        }}
      />
      <Screen backdrop>
        {locked ? <Txt color={c.caution}>{t("flight.locked")}</Txt> : null}

        {/* Live preview of the values computed by @cielo/core deriveFlightTimes */}
        <Card style={{ borderColor: c.accent }}>
          <Txt variant="label">{t("flight.preview")}</Txt>
          <Row gap={space.md}>
            <Stat label={t("flight.total")} value={fmt(form.isFstd ? (input.fstdMin ?? 0) : derived.totalMin)} color={c.accent} />
            <Stat label={t("flight.air")} value={fmt(derived.airMin)} />
            <Stat label={t("flight.night")} value={fmt(derived.nightMin)} />
            <Stat label={t("flight.ifrTime")} value={fmt(derived.ifrMin)} />
          </Row>
          <Txt variant="small" mono>
            {t("flight.landings")} ☀ {derived.landingsDay} · ☾ {derived.landingsNight} — T/O ☀ {derived.takeoffsDay} · ☾ {derived.takeoffsNight}
          </Txt>
          {derived.warnings.map((w) => (
            <Txt key={w} variant="small" color={c.caution}>
              {t(`flight.warn.${w}` as I18nKey)}
            </Txt>
          ))}
        </Card>

        <Card>
          <ToggleRow label={t("flight.fstd")} value={form.isFstd} onChange={(v) => set("isFstd", v)} />
          <Field
            label={t("flight.date")}
            value={form.date}
            monoValue
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            onChangeText={(s) => set("date", s)}
          />
          <Row>
            <Chip label={t("common.today")} selected={form.date === todayUtc()} onPress={() => set("date", todayUtc())} />
            <Chip
              label={t("common.yesterday")}
              selected={form.date === addDays(todayUtc(), -1)}
              onPress={() => set("date", addDays(todayUtc(), -1))}
            />
          </Row>
          <Field
            label={t("flight.flightNumber")}
            value={form.flightNumber}
            monoValue
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={(s) => set("flightNumber", s)}
            placeholder="AFR1234"
          />
        </Card>

        {form.isFstd ? (
          <Card>
            <Field label={t("flight.fstdType")} value={form.fstdType} autoCapitalize="characters" onChangeText={(s) => set("fstdType", s)} />
            <Field label={t("flight.fstdQualification")} value={form.fstdQualification} onChangeText={(s) => set("fstdQualification", s)} />
            <DurationField label={t("flight.fstdMin")} value={form.fstdMin} onChange={(s) => set("fstdMin", s)} />
          </Card>
        ) : null}

        <Card>
          <Row style={{ alignItems: "flex-start" }} gap={space.md}>
            <AirportField label={t("flight.dep")} value={form.depIcao} onChange={(v) => set("depIcao", v)} />
            <AirportField label={t("flight.arr")} value={form.arrIcao} onChange={(v) => set("arrIcao", v)} />
          </Row>
          <Txt variant="small">{t("flight.clocksHint")}</Txt>
          <Row gap={space.sm} style={{ alignItems: "flex-start" }}>
            {clockField("out", "flight.out")}
            {clockField("off", "flight.off")}
            {clockField("on", "flight.on")}
            {clockField("in", "flight.in")}
          </Row>
        </Card>

        <Card>
          <Txt variant="label">{t("flight.aircraft")}</Txt>
          <Pressable
            onPress={() => setPicker(true)}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 10,
              padding: space.md,
              backgroundColor: c.bg,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Txt style={selectedAircraft ? mono : undefined} color={selectedAircraft ? c.text : c.muted}>
              {selectedAircraft ? aircraftLabel(selectedAircraft, aircraftTypes) : t("flight.chooseAircraft")}
            </Txt>
            {selectedType ? (
              <Txt variant="small">
                {selectedType.manufacturer} {selectedType.model}
              </Txt>
            ) : null}
          </Pressable>
          <AircraftPhoto registration={selectedAircraft?.registration} />
          {!selectedAircraft ? (
            <AircraftTypeField
              types={aircraftTypes}
              label={t("flight.typeOnly")}
              hint={form.typeIcao ? `${t("flight.typeChosen")} ${selectedType ? `${selectedType.manufacturer} ${selectedType.model} (${selectedType.icao})` : form.typeIcao}` : t("flight.typeOnlyHint")}
              onPick={(ty) => set("typeIcao", ty.icao)}
            />
          ) : null}
          <Segmented<OperationMode>
            label={t("flight.operation")}
            value={form.operation ?? selectedAircraft?.defaultOperation ?? (selectedType?.multiPilot ? "multi_pilot" : "single_pilot")}
            onChange={(v) => set("operation", v)}
            options={[
              { value: "single_pilot", label: t("flight.singlePilot") },
              { value: "multi_pilot", label: t("flight.multiPilot") },
            ]}
          />
          <Txt variant="label">{t("flight.function")}</Txt>
          <Row style={{ flexWrap: "wrap" }}>
            {PILOT_FUNCTIONS.map((fn) => (
              <Chip key={fn} label={fn} selected={form.function === fn} onPress={() => set("function", fn)} />
            ))}
          </Row>
          <Field
            label={t("flight.picName")}
            value={form.picName}
            onChangeText={(s) => set("picName", s)}
            placeholder={form.function === "PIC" ? t("flight.self") : ""}
            autoCapitalize="words"
          />
          <ToggleRow label={t("flight.ifr")} value={form.ifr} onChange={(v) => set("ifr", v)} />
          <ToggleRow label={t("flight.pilotFlying")} value={form.pilotFlying} onChange={(v) => set("pilotFlying", v)} />
        </Card>

        <Card>
          <ToggleRow label={t("flight.autoNight")} value={form.autoNight} onChange={(v) => set("autoNight", v)} />
          {!form.autoNight ? (
            <DurationField label={t("flight.nightManual")} value={form.nightManual} onChange={(s) => set("nightManual", s)} />
          ) : null}
          <ToggleRow label={t("flight.autoLandings")} value={form.autoLandings} onChange={(v) => set("autoLandings", v)} />
          {!form.autoLandings ? (
            <Row gap={space.xs}>
              <Stepper label={t("flight.takeoffsDay")} value={form.takeoffsDay} onChange={(v) => set("takeoffsDay", v)} />
              <Stepper label={t("flight.takeoffsNight")} value={form.takeoffsNight} onChange={(v) => set("takeoffsNight", v)} />
              <Stepper label={t("flight.landingsDay")} value={form.landingsDay} onChange={(v) => set("landingsDay", v)} />
              <Stepper label={t("flight.landingsNight")} value={form.landingsNight} onChange={(v) => set("landingsNight", v)} />
            </Row>
          ) : null}
        </Card>

        {!form.isFstd ? (
          <Card>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: advanced }}
              onPress={() => (tap(), setAdvanced((x) => !x))}
              hitSlop={6}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="label">{t("flight.advanced")}</Txt>
                  {!advanced ? (
                    <Txt variant="small" mono={!!advancedSummary}>
                      {advancedSummary || t("flight.advancedAuto")}
                    </Txt>
                  ) : null}
                </View>
                <Txt color={c.accent}>{advanced ? "▴" : "▾"}</Txt>
              </Row>
            </Pressable>
            {advanced ? (
              <>
                <Txt variant="small">{t("flight.advancedHint")}</Txt>
                {form.ifr ? (
                  <DurationField
                    label={t("flight.ifrOverride")}
                    hint={t("flight.ifrOverrideHint", { time: fmt(derived.totalMin) })}
                    value={form.ifrManual}
                    onChange={(s) => set("ifrManual", s)}
                  />
                ) : (
                  <Txt variant="small">{t("flight.ifrOverrideOff")}</Txt>
                )}
                <DurationField label={t("flight.actualImc")} hint={t("flight.cappedHint")} value={form.actualImc} onChange={(s) => set("actualImc", s)} />
                <DurationField label={t("flight.xc")} hint={t("flight.cappedHint")} value={form.xc} onChange={(s) => set("xc", s)} />
              </>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <Txt variant="label">{t("flight.approaches")}</Txt>
          {form.approaches.map((a, i) => {
            const update = (patch: Partial<Approach>) =>
              set(
                "approaches",
                form.approaches.map((x, j) => (j === i ? { ...x, ...patch } : x)),
              );
            return (
              <Row key={i} style={{ alignItems: "flex-end" }}>
                <View style={{ flex: 2, gap: space.xs }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
                    {(APPROACH_TYPES.includes(a.type) ? APPROACH_TYPES : [a.type, ...APPROACH_TYPES]).map((ty) => (
                      <Chip key={ty} label={ty} selected={a.type === ty} onPress={() => update({ type: ty })} />
                    ))}
                  </ScrollView>
                </View>
                <Field
                  style={{ flex: 1 }}
                  value={a.runway ?? ""}
                  placeholder={t("flight.runway")}
                  monoValue
                  autoCapitalize="characters"
                  onChangeText={(s) => update({ runway: s || undefined })}
                />
                <Stepper label="×" value={a.count} onChange={(v) => update({ count: v })} />
              </Row>
            );
          })}
          <Button
            kind="secondary"
            small
            title={t("flight.addApproach")}
            onPress={() => set("approaches", [...form.approaches, { type: form.ifr ? "ILS CAT I" : "Visual", count: 1 }])}
          />
        </Card>

        <Card>
          <Field label={t("flight.remarks")} value={form.remarks} multiline onChangeText={(s) => set("remarks", s)} />
        </Card>

        {existing && !existing.isFstd ? <FlightTrackCard flightId={existing.id} /> : null}
        {existing ? <FlightSignature flight={existing} /> : null}

        {error ? <Txt color={c.warning}>{error}</Txt> : null}
        <Button title={t("common.save")} onPress={save} disabled={locked} loading={saving} />
      </Screen>

      <AircraftPicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(a) => {
          const type = aircraftTypes.find((x) => x.id === a.aircraftTypeId);
          setForm((s) => ({ ...s, aircraftId: a.id, ifr: existing ? s.ifr : defaultIfrFor(pilot.defaultIfr, type) }));
          setPicker(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}
