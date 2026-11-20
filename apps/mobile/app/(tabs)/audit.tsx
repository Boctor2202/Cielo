import React, { useMemo } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { auditLogbook, type AuditIssue } from "@cielo/core";
import { Card, Row, Screen, Txt } from "../../src/components/ui";
import { formatDate, type I18nKey } from "../../src/i18n";
import { lookupAirport } from "../../src/airports";
import { todayUtc, useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

const ORDER = ["error", "warning", "info"] as const;

export default function Audit() {
  const { t, locale, flights } = useApp();
  const c = useTheme();
  const today = todayUtc();
  const issues = useMemo(
    () => auditLogbook(flights, { today, airports: lookupAirport }),
    [flights, today],
  );
  const byId = useMemo(() => new Map(flights.map((f) => [f.id, f])), [flights]);
  const color = {
    error: c.warning,
    warning: c.caution,
    info: c.muted,
  } as const;
  const live = flights.filter((f) => !f.deletedAt).length;

  return (
    <Screen>
      <Txt variant="muted">{t("audit.subtitle", { n: live })}</Txt>
      {issues.length === 0 ? (
        <Card>
          <Row>
            <Ionicons name="checkmark-circle" size={20} color={c.success} />
            <Txt style={{ flex: 1 }}>{t("audit.clean")}</Txt>
          </Row>
        </Card>
      ) : null}
      {ORDER.map((sev) => {
        const list = issues.filter((i) => i.severity === sev);
        if (!list.length) return null;
        return (
          <Card key={sev}>
            <Txt variant="h2" color={color[sev]}>
              {t(`audit.sev.${sev}` as I18nKey)} · {list.length}
            </Txt>
            {list.slice(0, 150).map((i: AuditIssue, n) => {
              const f = byId.get(i.flightId);
              return (
                <Pressable
                  key={`${i.flightId}-${i.code}-${n}`}
                  onPress={() => router.push(`/flight/${i.flightId}`)}
                >
                  <Row style={{ alignItems: "flex-start" }}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Txt>
                        {t(
                          `audit.code.${i.code}` as I18nKey,
                          i.params as Record<string, string | number>,
                        )}
                      </Txt>
                      <Txt variant="small">{t(`audit.why.${i.code}` as I18nKey)}</Txt>
                      {f ? (
                        <Txt variant="small" mono>
                          {formatDate(f.date, locale)} · {f.depIcao}→{f.arrIcao}
                          {f.registration ? ` · ${f.registration}` : ""}
                        </Txt>
                      ) : null}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={c.muted}
                    />
                  </Row>
                </Pressable>
              );
            })}
          </Card>
        );
      })}
    </Screen>
  );
}
