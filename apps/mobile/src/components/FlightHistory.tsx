import React, { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { revertRevision, revisionFieldLabel, revisionValue, visibleChanges, type Flight, type FlightRevision } from "@cielo/core";
import { type I18nKey } from "../i18n";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Card, Row, Txt } from "./ui";

/** The flight's audit trail: every change, field by field, newest first; a change can be undone. */
export function FlightHistory({ flight }: { flight: Flight }) {
  const { t, locale, store, put } = useApp();
  const c = useTheme();
  const [revs, setRevs] = useState<FlightRevision[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let alive = true;
    void store.all("flight_revisions").then((rows) => {
      if (alive) setRevs(rows.filter((r) => r.flightId === flight.id && !r.deletedAt).sort((a, b) => b.at.localeCompare(a.at)));
    });
    return () => {
      alive = false;
    };
  }, [store, flight.id, flight.updatedAt]);
  if (!revs.length) return null;
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  const shown = all ? revs : revs.slice(0, 3);
  return (
    <Card>
      <Row style={{ alignItems: "center" }}>
        <Ionicons name="time-outline" size={18} color={c.muted} />
        <Txt variant="h2" style={{ flex: 1 }}>{t("hist.title", { n: revs.length })}</Txt>
      </Row>
      {shown.map((r) => {
        const ch = visibleChanges(r);
        return (
          <View key={r.id} style={{ gap: 2, paddingVertical: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt style={{ fontWeight: "600" }}>{t(`hist.action.${r.action}` as I18nKey)}</Txt>
              <Txt variant="small">{`${fmt(r.at)} · ${t(`hist.source.${r.source}` as I18nKey)}`}</Txt>
            </Row>
            {ch.map((x) => (
              <Txt key={x.field} variant="small" mono>
                {`${revisionFieldLabel(x.field, locale)} : ${revisionValue(x.field, x.from, locale)} → `}
                <Txt variant="small" mono color={c.text} style={{ fontWeight: "700" }}>{revisionValue(x.field, x.to, locale)}</Txt>
              </Txt>
            ))}
            {r.action === "update" && ch.length && !flight.locked && !flight.deletedAt ? (
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert(t("hist.undo"), t("hist.undoConfirm"), [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("hist.undo"),
                      onPress: async () => {
                        const cur = await store.get("flights", flight.id);
                        if (cur) await put("flights", revertRevision(cur, r));
                      },
                    },
                  ])
                }
              >
                <Txt variant="small" color={c.accent}>{t("hist.undo")}</Txt>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {revs.length > 3 ? (
        <Pressable onPress={() => setAll((x) => !x)} hitSlop={8}>
          <Txt variant="small" color={c.accent}>{all ? t("hist.less") : t("hist.more", { n: revs.length - 3 })}</Txt>
        </Pressable>
      ) : null}
    </Card>
  );
}
