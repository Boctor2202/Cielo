import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Aircraft, AircraftType, OperationMode } from "@cielo/core";
import { useApp } from "../state";
import { space, useTheme } from "../theme";
import { Button, Card, Chip, Field, Row, Segmented, Txt } from "./ui";

export function aircraftLabel(a: Aircraft | undefined, types: AircraftType[]): string {
  if (!a) return "";
  const type = types.find((x) => x.id === a.aircraftTypeId);
  return `${a.registration}${type ? ` · ${type.icao}` : ""}`;
}

/** Modal listing the pilot's aircraft, with a quick-add form (type from the reference AIRCRAFT_TYPES). */
export function AircraftPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (a: Aircraft) => void;
}) {
  const { t, aircraft, aircraftTypes, put, pilot } = useApp();
  const c = useTheme();
  const [reg, setReg] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [type, setType] = useState<AircraftType | null>(null);
  const [op, setOp] = useState<OperationMode>("single_pilot");
  const [err, setErr] = useState(false);

  const typeMatches = useMemo(() => {
    const q = typeQuery.trim().toUpperCase();
    if (!q) return [];
    return aircraftTypes
      .filter((x) => x.icao.startsWith(q) || `${x.manufacturer} ${x.model}`.toUpperCase().includes(q))
      .slice(0, 8);
  }, [typeQuery, aircraftTypes]);

  const add = async () => {
    if (!reg.trim() || !type) return setErr(true);
    const a = await put("aircraft", {
      pilotId: pilot.id,
      registration: reg.trim().toUpperCase(),
      aircraftTypeId: type.id,
      defaultOperation: op,
    });
    setReg("");
    setTypeQuery("");
    setType(null);
    setErr(false);
    onPick(a);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
        <Row style={{ justifyContent: "space-between", padding: space.lg }}>
          <Txt variant="h2">{t("aircraft.pick")}</Txt>
          <Button kind="ghost" small title={t("common.close")} onPress={onClose} />
        </Row>
        <FlatList
          data={aircraft}
          keyExtractor={(a) => a.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xxl }}
          ListHeaderComponent={<Txt variant="label">{t("aircraft.mine")}</Txt>}
          ListEmptyComponent={<Txt variant="muted">{t("aircraft.none")}</Txt>}
          renderItem={({ item }) => {
            const ty = aircraftTypes.find((x) => x.id === item.aircraftTypeId);
            return (
              <Pressable onPress={() => onPick(item)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <View style={{ padding: space.md, borderRadius: 10, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }}>
                  <Txt mono style={{ fontWeight: "600" }}>
                    {item.registration}
                  </Txt>
                  <Txt variant="small">{ty ? `${ty.icao} · ${ty.manufacturer} ${ty.model}` : "—"}</Txt>
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <Card style={{ marginTop: space.lg }}>
              <Txt variant="h2">{t("aircraft.quickAdd")}</Txt>
              <Field
                label={t("aircraft.registration")}
                value={reg}
                onChangeText={setReg}
                autoCapitalize="characters"
                autoCorrect={false}
                monoValue
                placeholder="F-GABC"
                error={err && !reg.trim()}
              />
              <Field
                label={t("aircraft.type")}
                value={type ? `${type.icao} — ${type.manufacturer} ${type.model}` : typeQuery}
                onChangeText={(s) => {
                  setType(null);
                  setTypeQuery(s);
                }}
                placeholder={t("aircraft.searchType")}
                autoCorrect={false}
                error={err && !type}
              />
              {!type && typeMatches.length > 0 ? (
                <Row style={{ flexWrap: "wrap" }}>
                  {typeMatches.map((x) => (
                    <Chip
                      key={x.id}
                      label={`${x.icao} · ${x.model}`}
                      onPress={() => {
                        setType(x);
                        setOp(x.multiPilot ? "multi_pilot" : "single_pilot");
                      }}
                    />
                  ))}
                </Row>
              ) : null}
              <Segmented
                label={t("aircraft.operation")}
                value={op}
                onChange={setOp}
                options={[
                  { value: "single_pilot", label: t("aircraft.single") },
                  { value: "multi_pilot", label: t("aircraft.multi") },
                ]}
              />
              {err ? <Txt color={c.warning}>{t("aircraft.missing")}</Txt> : null}
              <Button title={t("common.add")} onPress={add} />
            </Card>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
