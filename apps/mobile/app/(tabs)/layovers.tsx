import React, { useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, EmptyState, Field, Row, Screen, Txt } from "../../src/components/ui";
import { lookupAirport } from "../../src/airports";
import { formatDate } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { Requires } from "../../src/components/Access";
import { useTheme } from "../../src/theme";

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
          <Field label={t("lay.airport")} value={icao} onChangeText={(v) => setIcao(v.toUpperCase())} autoCapitalize="characters" maxLength={4} monoValue hint={airport ? `${airport.name}${airport.city ? ` · ${airport.city}` : ""}` : undefined} />
          <Row gap={12}>
            <Field style={{ flex: 1 }} label={t("lay.arrival")} value={from} onChangeText={setFrom} monoValue error={!isDate(from)} />
            <Field style={{ flex: 1 }} label={t("lay.departure")} value={to} onChangeText={setTo} monoValue error={!isDate(to)} />
          </Row>
          <Row gap={12}>
            <Button style={{ flex: 1 }} kind="secondary" title={t("common.cancel")} onPress={() => setAdding(false)} />
            <Button style={{ flex: 1 }} title={t("lay.create")} disabled={!airport || !isDate(from) || !isDate(to)} onPress={create} />
          </Row>
        </Card>
      ) : (
        <Button title={`+  ${t("lay.new")}`} onPress={() => setAdding(true)} />
      )}

      {layovers.length === 0 && !adding ? <EmptyState title={t("lay.empty")} hint={t("lay.emptyHint")} /> : null}

      {layovers.map((l) => {
        const a = lookupAirport(l.airportIcao);
        return (
          <Card key={l.id} onPress={() => router.push(`/layover/${l.id}` as never)}>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="h2">{a?.city || a?.name || l.airportIcao}</Txt>
                <Txt variant="small">
                  {l.airportIcao}
                  {l.arrivalUtc ? ` · ${formatDate(l.arrivalUtc, locale)}` : ""}
                  {l.departureUtc && l.departureUtc.slice(0, 10) !== l.arrivalUtc?.slice(0, 10) ? ` → ${formatDate(l.departureUtc, locale)}` : ""}
                </Txt>
                {l.hotelName ? (
                  <Row gap={6} style={{ marginTop: 4 }}>
                    <Ionicons name="bed-outline" size={14} color={c.muted} />
                    <Txt variant="small" numberOfLines={1}>{l.hotelName}</Txt>
                  </Row>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
