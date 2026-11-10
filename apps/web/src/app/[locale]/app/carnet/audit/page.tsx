"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { auditLogbook, type AuditSeverity } from "@cielo/core";
import { Link } from "@/i18n/navigation";
import { Card, Empty, PageTitle } from "@/components/app/ui";
import { useAirports } from "@/lib/airports";
import { useFlights, useFormatDate, useToday } from "@/lib/hooks";

const ICON = { error: AlertOctagon, warning: AlertTriangle, info: Info };
const COLOR = { error: "text-warning", warning: "text-caution", info: "text-accent" };

export default function AuditPage() {
  const t = useTranslations("app.audit");
  const flights = useFlights();
  const airports = useAirports();
  const today = useToday();
  const fd = useFormatDate();
  const issues = useMemo(() => (flights && airports ? auditLogbook(flights, { today, airports: (c) => airports.get(c) }) : null), [flights, airports, today]);
  const byId = useMemo(() => new Map((flights ?? []).map((f) => [f.id, f])), [flights]);

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle", { count: flights?.length ?? 0 })} />
      {!issues ? (
        <p className="text-muted">…</p>
      ) : issues.length === 0 ? (
        <Card>
          <Empty icon={<CheckCircle2 size={40} className="text-success" />} text={t("clean")} />
        </Card>
      ) : (
        <div className="space-y-5">
          {(["error", "warning", "info"] as AuditSeverity[]).map((sev) => {
            const list = issues.filter((i) => i.severity === sev);
            if (!list.length) return null;
            const Icon = ICON[sev];
            return (
              <Card key={sev} pad={false} title={<span className={`flex items-center gap-2 ${COLOR[sev]}`}><Icon size={17} /> {t(`severity.${sev}`)} · {list.length}</span>}>
                <ul className="divide-y divide-border">
                  {list.slice(0, 300).map((i, n) => {
                    const f = byId.get(i.flightId);
                    return (
                      <li key={`${i.flightId}-${i.code}-${n}`} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">{t(`codes.${i.code}`, (i.params ?? {}) as Record<string, string>)}</p>
                          {f && <p className="num text-xs text-muted">{fd(f.date)} · {f.isFstd ? "FSTD" : `${f.depIcao} → ${f.arrIcao}`} · {f.registration ?? ""}</p>}
                        </div>
                        <Link href={{ pathname: "/app/carnet/[id]", params: { id: i.flightId } }} className="btn btn-secondary btn-sm self-start">{t("open")}</Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
