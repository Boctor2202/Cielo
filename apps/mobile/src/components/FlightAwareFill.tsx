import React, { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { API_URL } from "../api";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Row, Txt, tap } from "./ui";

export interface FoundFlight {
  id: string;
  ident?: string;
  source?: "adsb" | "flightaware";
  dep?: string;
  arr?: string;
  out?: string;
  off?: string;
  on?: string;
  in?: string;
  diverted?: boolean;
}

const hhmm = (iso?: string) => (iso ? iso.slice(11, 16) : "—");

/**
 * "Fill from FlightAware": the aircraft's flights on the flight date (by registration), with their actual
 * block and runway times (UTC); picking one fills the form.
 */
export function FlightAwareFill({ registration, date, onPick }: { registration?: string; date: string; onPick: (f: FoundFlight) => void }) {
  const { t, session } = useApp();
  const c = useTheme();
  const [state, setState] = useState<"idle" | "loading" | "list" | "none" | "error" | "off" | "signin" | "limit" | "history" | "window">("idle");
  const [flights, setFlights] = useState<FoundFlight[]>([]);
  const ready = !!registration && registration.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const search = async () => {
    tap();
    if (!session?.access_token) return setState("signin");
    setState("loading");
    try {
      const r = await fetch(`${API_URL}/api/flight-lookup?reg=${encodeURIComponent(registration!)}&date=${date}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const d = (await r.json().catch(() => ({}))) as { flights?: FoundFlight[]; error?: string };
      if (!r.ok) return setState(d.error === "not_configured" ? "off" : d.error === "signin" ? "signin" : d.error === "history_off" ? "history" : d.error === "adsb_window" ? "window" : r.status === 429 ? "limit" : "error");
      setFlights(d.flights ?? []);
      setState(d.flights?.length ? "list" : "none");
    } catch {
      setState("error");
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={search}
        disabled={!ready || state === "loading"}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.accent, opacity: ready ? 1 : 0.45 }}
      >
        {state === "loading" ? <ActivityIndicator size="small" color={c.accent} /> : <Ionicons name="radio-outline" size={15} color={c.accent} />}
        <Txt style={{ fontWeight: "700", fontSize: 13.5 }} color={c.accent}>{t("fa.button")}</Txt>
      </Pressable>
      {!ready ? <Txt variant="small">{t("fa.needReg")}</Txt> : null}
      {state === "none" ? <Txt variant="small">{t("fa.none")}</Txt> : null}
      {state === "error" ? <Txt variant="small" color={c.warning}>{t("fa.error")}</Txt> : null}
      {state === "off" ? <Txt variant="small">{t("fa.off")}</Txt> : null}
      {state === "signin" ? <Txt variant="small">{t("fa.signin")}</Txt> : null}
      {state === "limit" ? <Txt variant="small">{t("fa.limit")}</Txt> : null}
      {state === "window" ? <Txt variant="small">{t("fa.window")}</Txt> : null}
      {state === "history" ? <Txt variant="small">{t("fa.history")}</Txt> : null}
      {state === "list"
        ? flights.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => {
                tap();
                onPick(f);
                setState("idle");
              }}
              style={({ pressed }) => ({ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,22,38,0.12)", backgroundColor: pressed ? c.accent + "1A" : "transparent", gap: 4 })}
            >
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Txt mono style={{ fontWeight: "800", fontSize: 16 }}>{`${f.dep ?? "?"} → ${f.arr ?? "?"}`}</Txt>
                <Txt mono variant="small">{f.ident ?? ""}{f.diverted ? ` · ${t("fa.diverted")}` : ""}</Txt>
              </Row>
              <Txt mono variant="small">{`OUT ${hhmm(f.out)} · OFF ${hhmm(f.off)} · ON ${hhmm(f.on)} · IN ${hhmm(f.in)} UTC`}</Txt>
            </Pressable>
          ))
        : null}
      {state === "list" ? <Txt variant="small" style={{ fontSize: 11 }}>{t(flights[0]?.source === "adsb" ? "fa.attributionAdsb" : "fa.attribution")}</Txt> : null}
    </View>
  );
}
