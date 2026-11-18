import React, { useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { licenseStatus } from "@cielo/core";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useWide, Appear, Card, Dot, EmptyState, Fab, Row, Txt, statusColor, tap } from "../../src/components/ui";
import { Track } from "../../src/components/Bars";
import { formatDate, type I18nKey } from "../../src/i18n";
import { statusLabel } from "../../src/licenseLabel";
import { todayUtc, useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

const ORDER = { expired: 0, expiring: 1, valid: 2, no_expiry: 3 } as const;
const ICON = { licence: ["card", "#0A84FF"], medical: ["medkit", "#FF453A"], rating: ["airplane", "#5E5CE6"], class_rating: ["airplane-outline", "#5E5CE6"], type_rating: ["airplane", "#5E5CE6"], skill_rating: ["star", "#BF5AF2"], radio: ["radio", "#64D2FF"], insurance: ["shield-checkmark", "#34C759"], endorsement: ["ribbon", "#FF9F0A"], language: ["chatbubbles", "#30B0C7"], other: ["document-text", "#8E8E93"] } as const;

export default function Documents() {
  const { access, t, locale, licenses } = useApp();
  const wide = useWide();
  const c = useTheme();
  const today = todayUtc();
  const items = useMemo(
    () =>
      licenses
        .map((l) => ({ l, s: licenseStatus(l, today) }))
        .sort((a, b) => ORDER[a.s.state] - ORDER[b.s.state] || (a.s.daysLeft ?? 99999) - (b.s.daysLeft ?? 99999)),
    [licenses, today],
  );

  const glass = c.scheme === "dark" ? "rgba(17,34,58,0.72)" : "rgba(243,246,249,0.8)";
  const edge = c.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(10,22,38,0.08)";
  // the closest expiry still ahead
  const next = items.filter((x) => x.s.daysLeft !== undefined && x.s.state !== "expired" && x.l.validUntil).sort((a, b) => a.s.daysLeft! - b.s.daysLeft!)[0];

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <FlatList
        data={items}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(x) => x.l.id}
        contentContainerStyle={[{ padding: space.lg, gap: space.md, paddingBottom: 140, flexGrow: 1 }, wide ? { width: "100%", maxWidth: 760, alignSelf: "center" } : null]}
        ListEmptyComponent={<EmptyState title={t("docs.empty")} hint={t("docs.emptyHint")} />}
        ListHeaderComponent={
          items.length ? (
            <Appear>
              <View style={{ gap: space.md }}>
                {next ? (
                  <Pressable onPress={() => (tap(), router.push({ pathname: "/document/[id]", params: { id: next.l.id } }))} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                    <View style={{ borderRadius: 22, padding: 16, overflow: "hidden", backgroundColor: glass, borderWidth: 1, borderColor: statusColor(c, next.s.state) + "55" }}>
                      <View style={{ position: "absolute", right: -40, top: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: statusColor(c, next.s.state), opacity: 0.14 }} />
                      <Row gap={6} style={{ alignItems: "center" }}>
                        <Ionicons name="time-outline" size={13} color={c.muted} />
                        <Txt variant="label">{t("docs.nextExpiry")}</Txt>
                      </Row>
                      <Row style={{ alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Row gap={8} style={{ alignItems: "center" }}>
                            <Ionicons name={(ICON[next.l.kind] ?? ICON.other)[0]} size={18} color={(ICON[next.l.kind] ?? ICON.other)[1]} />
                            <Txt numberOfLines={1} style={{ fontSize: 19, fontWeight: "800", flexShrink: 1 }}>{next.l.code}</Txt>
                          </Row>
                          <Txt variant="small">{formatDate(next.l.validUntil!, locale)}</Txt>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Txt mono style={{ fontSize: 34, fontWeight: "800", lineHeight: 38 }} color={statusColor(c, next.s.state)}>{String(next.s.daysLeft)}</Txt>
                          <Txt variant="small">{t("docs.daysUnit")}</Txt>
                        </View>
                      </Row>
                    </View>
                  </Pressable>
                ) : null}
                <Row gap={8}>
                  {(["valid", "expiring", "expired"] as const).map((k) => {
                    const n = items.filter((x) => (k === "valid" ? x.s.state === "valid" || x.s.state === "no_expiry" : x.s.state === k)).length;
                    const tone = statusColor(c, k);
                    return (
                      <View key={k} style={{ flex: 1, padding: 12, gap: 6, borderRadius: 16, backgroundColor: glass, borderWidth: 1, borderColor: edge }}>
                        <View style={{ width: 26, height: 4, borderRadius: 2, backgroundColor: tone, opacity: n ? 1 : 0.35 }} />
                        <Txt mono style={{ fontSize: 24, fontWeight: "800" }}>{String(n)}</Txt>
                        <Txt variant="small">{t(`docs.sum.${k}` as I18nKey)}</Txt>
                      </View>
                    );
                  })}
                </Row>
              </View>
            </Appear>
          ) : undefined
        }
        renderItem={({ item: { l, s } }) => {
          const color = statusColor(c, s.state);
          const [icon, tile] = ICON[l.kind] ?? ICON.other;
          // share of the validity still ahead (from issue, or from a year before expiry when the issue date is unknown)
          const start = l.issuedOn ? Date.parse(l.issuedOn) : l.validUntil ? Date.parse(l.validUntil) - 365 * 86_400_000 : 0;
          const left = l.validUntil ? Math.max(0, Math.min(1, (Date.parse(l.validUntil) - Date.now()) / Math.max(1, Date.parse(l.validUntil) - start))) : null;
          return (
            <Card onPress={() => router.push({ pathname: "/document/[id]", params: { id: l.id } })} style={{ borderLeftWidth: 4, borderLeftColor: color }}>
              <Row gap={12}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tile, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={icon} size={19} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="h2" numberOfLines={1}>{l.code}</Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {t(`docs.kind.${l.kind}` as I18nKey)}
                    {l.authority ? ` · ${l.authority}` : ""}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Row gap={6}>
                    <Dot color={color} />
                    <Txt variant="small" color={color} style={{ fontWeight: "600" }}>
                      {statusLabel(t, s)}
                    </Txt>
                  </Row>
                  {l.validUntil ? (
                    <Txt mono variant="small">
                      {formatDate(l.validUntil, locale)}
                    </Txt>
                  ) : null}
                </View>
              </Row>
              {left !== null ? <Track ratio={left} color={color} /> : null}
            </Card>
          );
        }}
      />
      <Fab label={t("docs.new")} onPress={() => (access.canWrite ? router.push({ pathname: "/document/[id]", params: { id: "new" } }) : router.push("/subscription"))} />
    </View>
  );
}
