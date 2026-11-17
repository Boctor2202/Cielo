import React, { useState } from "react";
import { Alert, View } from "react-native";
import { AIRCRAFT_CATEGORIES, ENGINE_TYPES, type AircraftCategory, type AircraftType, type EngineType } from "@cielo/core";
import type { I18nKey } from "../i18n";
import { useApp } from "../state";
import { space, useTheme } from "../theme";
import { Button, Card, Chip, Field, Row, Stepper, ToggleRow, Txt } from "./ui";

/** A search query that looks like an ICAO designator ("PA28", "c42") prefills the code, anything else the model. */
export function customTypeSeed(query: string): { icao?: string; model?: string } {
  const q = query.trim();
  if (!q) return {};
  return /^[a-z0-9]{2,4}$/i.test(q) ? { icao: q.toUpperCase() } : { model: q };
}

/**
 * Creates a pilot-owned AircraftType (same fields as the web's custom type, saved like saveCustomType:
 * upper-case ICAO, ownerPilotId = the pilot). It lands in `aircraftTypes`, so every type search finds it.
 */
export function CustomTypeForm({
  initial,
  onCreated,
  onCancel,
}: {
  initial?: { icao?: string; model?: string };
  onCreated: (t: AircraftType) => void;
  onCancel: () => void;
}) {
  const { t, put, pilot } = useApp();
  const c = useTheme();
  const [icao, setIcao] = useState(initial?.icao ?? "");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState(initial?.model ?? "");
  const [rating, setRating] = useState("");
  const [category, setCategory] = useState<AircraftCategory>("airplane");
  const [engineType, setEngineType] = useState<EngineType>("piston");
  const [engineCount, setEngineCount] = useState(1);
  const [multiPilot, setMultiPilot] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!icao.trim() || !model.trim()) return setError(true);
    setSaving(true);
    try {
      const row = await put("aircraft_types", {
        icao: icao.trim().toUpperCase(),
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        category,
        engineType,
        engineCount: engineType === "none" ? 0 : engineCount,
        multiPilot,
        classOrTypeRating: rating.trim() || undefined,
        ownerPilotId: pilot.id,
      });
      onCreated(row);
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error && e.message === "read_only" ? t("access.readOnlyBanner") : e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Txt variant="h2">{t("acft.newType")}</Txt>
      <Row gap={space.md} style={{ alignItems: "flex-start" }}>
        <Field
          style={{ flex: 1 }}
          label={t("acft.icao")}
          value={icao}
          onChangeText={(s) => setIcao(s.toUpperCase().replace(/\s/g, ""))}
          autoCapitalize="characters"
          autoCorrect={false}
          monoValue
          placeholder="PA28"
          error={error && !icao.trim()}
        />
        <Field
          style={{ flex: 2 }}
          label={t("acft.manufacturer")}
          value={manufacturer}
          onChangeText={setManufacturer}
          autoCapitalize="words"
          placeholder="Piper"
        />
      </Row>
      <Field label={t("acft.model")} value={model} onChangeText={setModel} placeholder="PA-28 Cherokee" error={error && !model.trim()} />
      <Field
        label={t("acft.rating")}
        value={rating}
        onChangeText={setRating}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="SEP(L), MEP(L), A320…"
      />
      <Txt variant="label">{t("acft.category")}</Txt>
      <Row style={{ flexWrap: "wrap" }}>
        {AIRCRAFT_CATEGORIES.map((x) => (
          <Chip key={x} label={t(`acft.cat.${x}` as I18nKey)} selected={category === x} onPress={() => setCategory(x)} />
        ))}
      </Row>
      <Txt variant="label">{t("acft.engineType")}</Txt>
      <Row style={{ flexWrap: "wrap" }}>
        {ENGINE_TYPES.map((x) => (
          <Chip
            key={x}
            label={t(`acft.engine.${x}` as I18nKey)}
            selected={engineType === x}
            onPress={() => {
              setEngineType(x);
              if (x === "none") setEngineCount(0);
              else if (engineCount === 0) setEngineCount(1);
            }}
          />
        ))}
      </Row>
      {engineType !== "none" ? (
        <View style={{ alignSelf: "flex-start", minWidth: 120 }}>
          <Stepper label={t("acft.engineCount")} value={engineCount} onChange={(v) => setEngineCount(Math.min(8, Math.max(1, v)))} />
        </View>
      ) : null}
      <ToggleRow label={t("acft.multiPilotCert")} value={multiPilot} onChange={setMultiPilot} />
      {error ? <Txt color={c.warning}>{t("acft.typeFieldsRequired")}</Txt> : null}
      <Row>
        <View style={{ flex: 1 }}>
          <Button kind="secondary" title={t("common.cancel")} onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t("acft.createTypeSave")} onPress={() => void create()} loading={saving} />
        </View>
      </Row>
    </Card>
  );
}
