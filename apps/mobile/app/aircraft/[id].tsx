import React, { useState } from "react";
import { Alert, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import type { AircraftType, OperationMode } from "@cielo/core";
import { Button, Card, Field, Row, Screen, Segmented, ToggleRow, Txt } from "../../src/components/ui";
import { AircraftTypeField } from "../../src/components/AircraftTypeField";
import { CustomTypeForm, customTypeSeed } from "../../src/components/CustomTypeForm";
import { AircraftPhoto } from "../../src/components/AircraftPhoto";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

export default function AircraftEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, aircraft, aircraftTypes, put, remove, pilot, flights } = useApp();
  const c = useTheme();
  const existing = id && id !== "new" ? aircraft.find((a) => a.id === id) : undefined;
  const [reg, setReg] = useState(existing?.registration ?? "");
  const [type, setType] = useState<AircraftType | undefined>(aircraftTypes.find((x) => x.id === existing?.aircraftTypeId));
  const [variant, setVariant] = useState(existing?.variant ?? "");
  const [operator, setOperator] = useState(existing?.operator ?? "");
  const [op, setOp] = useState<OperationMode>(existing?.defaultOperation ?? "single_pilot");
  const [complex, setComplex] = useState(!!existing?.complex);
  const [hp, setHp] = useState(!!existing?.highPerformance);
  const [tw, setTw] = useState(!!existing?.tailwheel);
  const [error, setError] = useState(false);
  /** set while the "create a type" form is open, with the values seeded from the search */
  const [creating, setCreating] = useState<{ icao?: string; model?: string } | null>(null);
  const pickType = (x: AircraftType) => {
    setType(x);
    if (x.multiPilot) setOp("multi_pilot");
  };

  const save = async () => {
    if (!reg.trim() || !type) return setError(true);
    await put("aircraft", {
      ...(existing ?? {}),
      pilotId: pilot.id,
      registration: reg.trim().toUpperCase(),
      aircraftTypeId: type.id,
      variant: variant.trim() || undefined,
      operator: operator.trim() || undefined,
      defaultOperation: op,
      complex,
      highPerformance: hp,
      tailwheel: tw,
    });
    router.back();
  };
  const used = existing ? flights.filter((f) => !f.deletedAt && f.registration?.toUpperCase() === existing.registration.toUpperCase()).length : 0;
  const del = () =>
    Alert.alert(t("acft.deleteTitle"), used ? t("acft.deleteUsed", { n: used }) : t("acft.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => void remove("aircraft", existing!.id).then(() => router.back()) },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: existing ? existing.registration : t("acft.add") }} />
      <Screen backdrop>
        {existing ? <AircraftPhoto registration={existing.registration} /> : null}
        <Card>
          <Field label={t("aircraft.registration")} value={reg} onChangeText={(v) => setReg(v.toUpperCase())} autoCapitalize="characters" monoValue error={error && !reg.trim()} />
          {type ? (
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Txt variant="label">{t("acft.type")}</Txt>
                <Txt>{type.manufacturer} {type.model} <Txt mono variant="small">({type.icao})</Txt></Txt>
              </View>
              <Button kind="ghost" small title={t("common.edit")} onPress={() => setType(undefined)} />
            </Row>
          ) : creating ? (
            <Txt variant="small">{t("acft.creatingType")}</Txt>
          ) : (
            <AircraftTypeField
              types={aircraftTypes}
              label={t("acft.type")}
              hint={error ? t("acft.typeRequired") : undefined}
              onPick={pickType}
              onCreate={(q) => setCreating(customTypeSeed(q))}
            />
          )}
          <Field label={t("acft.variant")} value={variant} onChangeText={setVariant} />
          <Field label={t("acft.operator")} value={operator} onChangeText={setOperator} />
        </Card>
        {creating && !type ? (
          <CustomTypeForm
            initial={creating}
            onCancel={() => setCreating(null)}
            onCreated={(x) => {
              setCreating(null);
              pickType(x);
            }}
          />
        ) : null}
        <Card>
          <Segmented<OperationMode>
            label={t("acft.defaultOperation")}
            value={op}
            onChange={setOp}
            options={[
              { value: "single_pilot", label: t("acft.sp") },
              { value: "multi_pilot", label: t("acft.mp") },
            ]}
          />
          <ToggleRow label={t("acft.complex")} value={complex} onChange={setComplex} />
          <ToggleRow label={t("acft.hp")} value={hp} onChange={setHp} />
          <ToggleRow label={t("acft.tailwheel")} value={tw} onChange={setTw} />
        </Card>
        {error ? <Txt color={c.warning}>{t("acft.required")}</Txt> : null}
        <Button title={t("common.save")} onPress={() => void save()} />
        {existing ? <Button kind="danger" title={t("common.delete")} onPress={del} /> : null}
      </Screen>
    </>
  );
}
