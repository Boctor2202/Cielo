import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { feedLabel, type Roster } from "@cielo/core";
import { feedRosters, lastFeedSync, subscribeFeed, syncFeed, unsubscribeFeed, type FeedResult } from "../calendarFeeds";
import { useApp } from "../state";
import type { I18nKey } from "../i18n";
import { space, useTheme } from "../theme";
import { Button, Field, Glass, Row, Txt } from "./ui";

/** The roster from a calendar the pilot subscribes to (iCloud, Google, Outlook, a crew portal), synced every hour. */
export function CalendarFeedsCard() {
  const { t, store, pilot, session, reload, access } = useApp();
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<(Roster & { last: string | null })[]>([]);
  const load = useCallback(async () => {
    const rs = await feedRosters(store);
    setFeeds(await Promise.all(rs.map(async (r) => ({ ...r, last: await lastFeedSync(store, r.id) }))));
  }, [store]);
  useEffect(() => {
    void load();
  }, [load]);
  const done = async (r: FeedResult) => {
    await load();
    if ("error" in r) return Alert.alert(t("roster.feed.title"), t(`roster.feed.err.${r.error}` as I18nKey));
    await reload();
    Alert.alert(t("roster.feed.title"), t("roster.feed.done", r));
  };
  if (!access.canWrite) return null;
  return (
    <Glass style={{ padding: space.md, gap: space.sm, marginTop: space.sm }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Row style={{ justifyContent: "space-between" }}>
          <Txt style={{ fontWeight: "700" }}>{t("roster.feed.title")}</Txt>
          <Txt variant="small">{feeds.length ? feeds.map((f) => feedLabel(f.fileName!)).join(" · ") : open ? "−" : "+"}</Txt>
        </Row>
      </Pressable>
      {open && (
        <View style={{ gap: space.sm }}>
          <Txt variant="small">{t("roster.feed.help")}</Txt>
          <Field value={url} onChangeText={setUrl} placeholder={t("roster.feed.placeholder")} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Button
            small
            title={t("roster.feed.subscribe")}
            loading={busy === "new"}
            disabled={!url.trim() || busy !== null}
            onPress={async () => {
              setBusy("new");
              const r = await subscribeFeed(store, pilot, url, session?.access_token);
              setBusy(null);
              if (!("error" in r)) setUrl("");
              await done(r);
            }}
          />
          <Txt variant="small">{t("roster.feed.how")}</Txt>
        </View>
      )}
      {feeds.map((f) => (
        <Row key={f.id} style={{ justifyContent: "space-between", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: "600" }}>{feedLabel(f.fileName!)}</Txt>
            <Txt variant="small">{f.last ? t("roster.feed.last", { when: new Date(f.last).toLocaleString() }) : t("roster.feed.never")}</Txt>
          </View>
          <Button
            kind="secondary"
            small
            title={t("roster.feed.syncNow")}
            loading={busy === f.id}
            onPress={async () => {
              setBusy(f.id);
              const r = await syncFeed(store, pilot, f, session?.access_token);
              setBusy(null);
              await done(r);
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("roster.feed.remove")}
            onPress={() =>
              Alert.alert(t("roster.feed.remove"), t("roster.feed.removeConfirm"), [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("roster.feed.remove"), style: "destructive", onPress: async () => (await unsubscribeFeed(store, f), await load(), await reload()) },
              ])
            }
          >
            <Txt color={c.warning}>✕</Txt>
          </Pressable>
        </Row>
      ))}
    </Glass>
  );
}
