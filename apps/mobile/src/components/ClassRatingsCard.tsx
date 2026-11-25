import React, { useMemo } from "react";
import { View } from "react-native";
import { classRatingStatus, type ClassRatingStatus } from "@cielo/core";
import { Card, Dot, Row, Txt } from "./ui";
import { Track } from "./Bars";
import { formatDate } from "../i18n";
import { todayUtc, useApp } from "../state";
import { useTheme } from "../theme";

const addMonths = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1 + n, day)).toISOString().slice(0, 10);
};

/**
 * SEP and MEP class ratings, for every pilot: the 90-day recent experience in the class (FCL.060(b)(1)) and the
 * revalidation of the rating (FCL.740.A): SEP by experience in the 12 months before expiry or a proficiency check,
 * MEP by a proficiency check in the 3 months before expiry and 10 route sectors.
 */
export function ClassRatingsCard() {
  const { t, locale, flights, aircraftTypes, licenses } = useApp();
  const c = useTheme();
  const today = todayUtc();
  const status = useMemo(() => classRatingStatus(flights, aircraftTypes, licenses, today), [flights, aircraftTypes, licenses, today]);
  const date = (d: string) => formatDate(d, locale);
  const bar = (label: string, n: number, of: number, hours = false) => {
    const ok = n >= of;
    const v = hours ? `${Math.floor(n)}:${String(Math.round((n % 1) * 60)).padStart(2, "0")} / ${of}:00` : `${n} / ${of}`;
    return (
      <View key={label} style={{ gap: 3 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt variant="small">{label}</Txt>
          <Txt variant="small" mono color={ok ? c.success : c.warning}>{v}</Txt>
        </Row>
        <Track ratio={Math.min(1, n / of)} color={ok ? c.success : c.warning} />
      </View>
    );
  };
  const block = (s: ClassRatingStatus) => (
    <View key={s.kind} style={{ gap: 8 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <Txt variant="h2">{s.kind}</Txt>
        {s.expiry ? (
          <Txt variant="small" mono color={(s.daysLeft ?? 0) < 0 ? c.warning : (s.daysLeft ?? 0) <= 90 ? c.caution : c.success}>
            {(s.daysLeft ?? 0) < 0 ? t("cls.expired", { date: date(s.expiry) }) : t("cls.until", { date: date(s.expiry) })}
          </Txt>
        ) : null}
      </Row>
      <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
        <Row style={{ flex: 1, alignItems: "center" }}>
          <Dot color={s.recency.valid ? c.success : c.warning} />
          <Txt variant="small" style={{ flex: 1 }}>{t("cls.recency")}</Txt>
        </Row>
        <Txt variant="small" mono color={s.recency.valid ? c.success : c.warning}>
          {s.recency.valid && s.recency.validUntil ? date(s.recency.validUntil) : `${Math.min(s.recency.takeoffs, s.recency.landings)}/3`}
        </Txt>
      </Row>
      {!s.expiry ? (
        <Txt variant="small" color={c.muted}>{t("cls.noExpiry", { kind: s.kind })}</Txt>
      ) : s.sep ? (
        <View style={{ gap: 6 }}>
          <Txt variant="small" color={c.muted}>{t("cls.sepRule", { from: date(s.sep.from), check: date(addMonths(s.expiry, -3)) })}</Txt>
          {bar(t("cls.hours"), s.sep.hours, 12, true)}
          {bar(t("cls.picHours"), s.sep.picHours, 6, true)}
          {bar(t("cls.takeoffs"), s.sep.takeoffs, 12)}
          {bar(t("cls.landings"), s.sep.landings, 12)}
          <Row style={{ justifyContent: "space-between" }}>
            <Txt variant="small" style={{ flex: 1 }}>{t("cls.instructor")}</Txt>
            <Txt variant="small" mono color={s.sep.instructorFlight ? c.success : c.warning}>{s.sep.instructorFlight ? date(s.sep.instructorFlight) : t("cls.todo")}</Txt>
          </Row>
        </View>
      ) : s.mep ? (
        <View style={{ gap: 6 }}>
          <Txt variant="small" color={c.muted}>{t("cls.mepRule", { from: date(s.mep.checkFrom), to: date(s.expiry) })}</Txt>
          {bar(t("cls.sectors"), s.mep.sectors, 10)}
        </View>
      ) : null}
    </View>
  );
  return (
    <Card>
      <Txt variant="label">{t("cls.title")}</Txt>
      {status.map(block)}
      <Txt variant="small" color={c.muted}>{t("cls.source")}</Txt>
    </Card>
  );
}
