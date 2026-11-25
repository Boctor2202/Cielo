import React, { useMemo } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { licenseStatus, type CurrencyItem } from "@cielo/core";
import { Badge, Card, Dot, EmptyState, Row, Screen, Txt, statusColor } from "../../src/components/ui";
import { Track } from "../../src/components/Bars";
import { formatDate, type I18nKey } from "../../src/i18n";
import { useCurrency } from "../../src/currency";
import { ClassRatingsCard } from "../../src/components/ClassRatingsCard";
import { holdsValidIr } from "../../src/currencyAlerts";
import { statusLabel } from "../../src/licenseLabel";
import { todayUtc, useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

/**
 * Recent experience at a glance: for each type or class rating flown this year, whether the pilot may carry
 * passengers (and at night), until when, and what is missing; then the documents that expire soonest.
 */
export default function Currency() {
  const { t, locale, pilot, licenses } = useApp();
  const c = useTheme();
  const { items } = useCurrency();
  const today = todayUtc();
  const ir = holdsValidIr(licenses, today);

  const groups = useMemo(() => {
    const m = new Map<string, CurrencyItem[]>();
    for (const i of items) m.set(i.group, [...(m.get(i.group) ?? []), i]);
    // the group needing attention first
    return [...m.entries()].sort(([, a], [, b]) => rank(a) - rank(b));
  }, [items]);

  const docs = useMemo(
    () =>
      licenses
        .filter((l) => !l.deletedAt && l.validUntil)
        .map((l) => ({ l, s: licenseStatus(l, today) }))
        .sort((a, b) => (a.l.validUntil ?? "").localeCompare(b.l.validUntil ?? ""))
        .slice(0, 6),
    [licenses, today],
  );

  const color = (i: CurrencyItem) => (!i.valid ? c.warning : (i.daysLeft ?? 99) <= 14 ? c.caution : c.success);
  const line = (i: CurrencyItem) => {
    if (!i.valid) {
      const unit = i.kind === "ifr" ? t("cur.approaches") : null;
      return unit
        ? t("cur.missingApproaches", { n: i.missingLandings })
        : t("cur.missing", { t: i.missingTakeoffs, l: i.missingLandings });
    }
    return t("cur.validUntil", { date: formatDate(i.validUntil!, locale), n: i.daysLeft ?? 0 });
  };

  return (
    <Screen columns>
      <Card>
        <Txt variant="small">
          {t(`cur.rules.${pilot.regulatoryFramework === "FAA" ? "faa" : "easa"}` as I18nKey)}
          {ir && pilot.regulatoryFramework !== "FAA" ? ` ${t("cur.irWaiver")}` : ""}
        </Txt>
      </Card>

      {groups.length === 0 ? <EmptyState title={t("cur.empty")} hint={t("cur.emptyHint")} /> : null}

      {groups.map(([group, list]) => (
        <Card key={group}>
          <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <Txt variant="h2">{group === "all" ? t("cur.ifrTitle") : group}</Txt>
            {list[0]?.types.length && group !== "all" && list[0].types.join(",") !== group ? (
              <Txt variant="small" mono>{list[0].types.join(" · ")}</Txt>
            ) : null}
          </Row>
          {list.map((i) => {
            const done = Math.min(i.takeoffs, i.landings);
            return (
              <View key={i.key} style={{ gap: 4 }}>
                <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <Row style={{ flex: 1, alignItems: "center" }}>
                    <Dot color={color(i)} />
                    <Txt style={{ fontWeight: "600" }}>{t(`cur.kind.${i.kind}` as I18nKey)}</Txt>
                  </Row>
                  <Txt mono variant="small">
                    {i.kind === "ifr" ? `${i.landings}/${i.required}` : `${i.takeoffs}/${i.required} · ${i.landings}/${i.required}`}
                  </Txt>
                </Row>
                <Track ratio={done / i.required} color={color(i)} />
                <Txt variant="small" color={i.valid ? undefined : c.warning}>{line(i)}</Txt>
              </View>
            );
          })}
          {list[0]?.lastFlown ? <Txt variant="small" color={c.muted}>{t("cur.lastFlown", { date: formatDate(list[0].lastFlown, locale) })}</Txt> : null}
        </Card>
      ))}

      <ClassRatingsCard />

      <Card onPress={() => router.navigate("/documents")}>
        <Txt variant="h2">{t("cur.validities")}</Txt>
        {docs.length === 0 ? <Txt variant="muted">{t("dash.noDocuments")}</Txt> : null}
        {docs.map(({ l, s }) => (
          <Row key={l.id} style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Txt numberOfLines={1} style={{ flex: 1 }}>{l.code}</Txt>
            <Badge text={statusLabel(t, s)} color={statusColor(c, s.state)} />
          </Row>
        ))}
      </Card>
      <View style={{ height: space.md }} />
    </Screen>
  );
}

/** lapsed first, then soonest to lapse */
function rank(list: CurrencyItem[]): number {
  return Math.min(...list.map((i) => (i.valid ? (i.daysLeft ?? 999) : -1)));
}
