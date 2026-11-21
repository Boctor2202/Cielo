import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDuration, type Flight } from "@cielo/core";
import { formatDate } from "../i18n";
import { useApp } from "../state";
import { space, useTheme } from "../theme";
import { Button, Row, Txt, tap } from "./ui";

/** The flights deleted from the logbook (kept on the phone and the account), most recently deleted first. */
export function useDeletedFlights(): Flight[] {
  const { store, flights } = useApp();
  const [deleted, setDeleted] = useState<Flight[]>([]);
  const load = useCallback(async () => {
    const all = await store.all("flights");
    setDeleted(all.filter((f) => !!f.deletedAt).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")));
  }, [store]);
  // read again whenever the logbook changes (a deletion or a restore)
  useEffect(() => void load(), [load, flights]);
  return deleted;
}

/** "Deleted flights": a flight deleted by mistake goes back to the logbook in one tap. */
export function TrashSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const { t, locale, pilot } = app;
  const c = useTheme();
  const deleted = useDeletedFlights();
  const [busy, setBusy] = useState(false);
  const back = async (fs: Flight[]) => {
    setBusy(true);
    try {
      await app.putMany("flights", fs.map((f) => ({ ...f, deletedAt: null })));
      tap("success");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 60 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Txt variant="h2">{t("trash.title")}</Txt>
          <Ionicons name="close" size={22} color={c.muted} onPress={onClose} />
        </Row>
        <Txt variant="small">{t("trash.hint")}</Txt>
        {deleted.length === 0 ? <Txt>{t("trash.empty")}</Txt> : null}
        {deleted.map((f) => (
          <Row key={f.id} style={{ alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }} gap={10}>
            <View style={{ flex: 1 }}>
              <Txt mono style={{ fontWeight: "700" }}>{f.isFstd ? f.fstdType || "FSTD" : `${f.depIcao} → ${f.arrIcao}`}  <Txt variant="small">{formatDuration(f.totalMin || f.fstdMin, pilot.timeDisplay)}</Txt></Txt>
              <Txt variant="small" numberOfLines={1}>
                {[formatDate(f.date, locale), f.aircraftTypeIcao, f.registration].filter(Boolean).join(" · ")} · {t("trash.deletedOn", { date: formatDate(f.deletedAt!.slice(0, 10), locale) })}
              </Txt>
            </View>
            <Pressable disabled={busy} onPress={() => void back([f])} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: c.accent }}>
              <Ionicons name="arrow-undo" size={14} color={c.accent} />
              <Txt variant="small" color={c.accent} style={{ fontWeight: "700" }}>{t("trash.restore")}</Txt>
            </Pressable>
          </Row>
        ))}
        {deleted.length > 1 ? <Button kind="secondary" title={t("trash.restoreAll", { n: deleted.length })} loading={busy} onPress={() => void back(deleted)} /> : null}
      </ScrollView>
    </Modal>
  );
}
