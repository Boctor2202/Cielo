import React, { useMemo } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { licenseStatus } from "@cielo/core";
import { Card, Dot, EmptyState, Fab, Row, Txt, statusColor } from "../../src/components/ui";
import { formatDate, type I18nKey } from "../../src/i18n";
import { statusLabel } from "../../src/licenseLabel";
import { todayUtc, useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

const ORDER = { expired: 0, expiring: 1, valid: 2, no_expiry: 3 } as const;

export default function Documents() {
  const { t, locale, licenses } = useApp();
  const c = useTheme();
  const today = todayUtc();
  const items = useMemo(
    () =>
      licenses
        .map((l) => ({ l, s: licenseStatus(l, today) }))
        .sort((a, b) => ORDER[a.s.state] - ORDER[b.s.state] || (a.s.daysLeft ?? 99999) - (b.s.daysLeft ?? 99999)),
    [licenses, today],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <FlatList
        data={items}
        keyExtractor={(x) => x.l.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 140, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t("docs.empty")} hint={t("docs.emptyHint")} />}
        renderItem={({ item: { l, s } }) => {
          const color = statusColor(c, s.state);
          return (
            <Card onPress={() => router.push({ pathname: "/document/[id]", params: { id: l.id } })}>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="h2">{l.code}</Txt>
                  <Txt variant="small">
                    {t(`docs.kind.${l.kind}` as I18nKey)}
                    {l.authority ? ` · ${l.authority}` : ""}
                    {l.number ? ` · ${l.number}` : ""}
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
            </Card>
          );
        }}
      />
      <Fab label={t("docs.new")} onPress={() => router.push({ pathname: "/document/[id]", params: { id: "new" } })} />
    </View>
  );
}
