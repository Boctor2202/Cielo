"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { classRatingStatus, type AircraftType, type ClassRatingStatus, type Flight, type License } from "@cielo/core";
import { Badge, Card, Meter, type Level } from "@/components/app/ui";
import { useFormatDate } from "@/lib/hooks";

const addMonths = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1 + n, day)).toISOString().slice(0, 10);
};

/**
 * SEP and MEP class ratings, for every pilot: the 90-day recent experience in the class (FCL.060(b)(1)) and the
 * revalidation of the rating (FCL.740.A): SEP by experience in the 12 months before expiry or a proficiency check,
 * MEP by a proficiency check in the 3 months before expiry and 10 route sectors.
 */
export function ClassRatingsCard({ flights, types, licenses, today }: { flights: Flight[]; types: AircraftType[]; licenses: License[]; today: string }) {
  const t = useTranslations("app.documents.cls");
  const fd = useFormatDate();
  const status = useMemo(() => classRatingStatus(flights, types, licenses, today), [flights, types, licenses, today]);
  const date = (d: string) => fd(d, { day: "numeric", month: "short", year: "numeric" });
  const bar = (label: string, n: number, of: number, unit = "") => (
    <div key={label}>
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-muted">{label}</span>
        <span className={`num ${n >= of ? "text-ok" : "text-warning"}`}>{unit ? `${Math.floor(n)}:${String(Math.round((n % 1) * 60)).padStart(2, "0")}` : n} / {of}{unit}</span>
      </div>
      <Meter value={Math.min(1, n / of)} max={1} level={n >= of ? "ok" : "warning"} />
    </div>
  );
  const block = (s: ClassRatingStatus) => {
    const lvl: Level = s.expiry ? ((s.daysLeft ?? 0) < 0 ? "warning" : (s.daysLeft ?? 0) <= 90 ? "caution" : "ok") : "neutral";
    return (
      <section key={s.kind} className="space-y-2.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{s.kind}</h3>
          {s.expiry ? <Badge level={lvl}>{(s.daysLeft ?? 0) < 0 ? t("expired", { date: date(s.expiry) }) : t("until", { date: date(s.expiry) })}</Badge> : null}
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>{t("recency")}</span>
          <Badge level={s.recency.valid ? "ok" : "warning"}>{s.recency.valid && s.recency.validUntil ? date(s.recency.validUntil) : `${Math.min(s.recency.takeoffs, s.recency.landings)}/3`}</Badge>
        </div>
        {!s.expiry ? (
          <p className="text-xs text-muted">{t("noExpiry", { kind: s.kind })}</p>
        ) : s.sep ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">{t("sepRule", { from: date(s.sep.from), check: date(addMonths(s.expiry, -3)) })}</p>
            {bar(t("hours"), s.sep.hours, 12, " h")}
            {bar(t("picHours"), s.sep.picHours, 6, " h")}
            {bar(t("takeoffs"), s.sep.takeoffs, 12)}
            {bar(t("landings"), s.sep.landings, 12)}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted">{t("instructor")}</span>
              <span className={`shrink-0 ${s.sep.instructorFlight ? "text-ok" : "text-warning"}`}>{s.sep.instructorFlight ? date(s.sep.instructorFlight) : t("todo")}</span>
            </div>
          </div>
        ) : s.mep ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">{t("mepRule", { from: date(s.mep.checkFrom), to: date(s.expiry) })}</p>
            {bar(t("sectors"), s.mep.sectors, 10)}
          </div>
        ) : null}
      </section>
    );
  };
  return (
    <Card title={t("title")}>
      <div className="space-y-4">{status.map(block)}</div>
      <p className="mt-3 text-[11px] text-muted">{t("source")}</p>
    </Card>
  );
}
