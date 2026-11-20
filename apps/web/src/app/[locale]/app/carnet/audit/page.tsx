"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { auditKey, auditLogbook, type AuditIssue, type AuditSeverity } from "@cielo/core";
import { localStore } from "@/lib/db";
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
  // explanations the pilot gave (this device): an edit of the flight makes the issue show again
  const [explained, setExplained] = useState<Record<string, { note: string; at: string }>>({});
  useEffect(() => {
    localStore.getMeta("auditExplained").then((v) => {
      try {
        if (v) setExplained(JSON.parse(v));
      } catch {}
    });
  }, []);
  const saveExplained = (next: typeof explained) => {
    setExplained(next);
    void localStore.setMeta("auditExplained", JSON.stringify(next));
  };
  const explain = (i: AuditIssue) => {
    const note = window.prompt(t("explainPrompt"))?.trim();
    if (!note) return;
    saveExplained({ ...explained, [auditKey(i, byId.get(i.flightId))]: { note, at: new Date().toISOString() } });
  };
  const open = (issues ?? []).filter((i) => !explained[auditKey(i, byId.get(i.flightId))]);
  const done = (issues ?? []).filter((i) => explained[auditKey(i, byId.get(i.flightId))]);

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle", { count: flights?.length ?? 0 })} />
      {!issues ? (
        <p className="text-muted">…</p>
      ) : open.length === 0 && done.length === 0 ? (
        <Card>
          <Empty icon={<CheckCircle2 size={40} className="text-success" />} text={t("clean")} />
        </Card>
      ) : (
        <div className="space-y-5">
          {(["error", "warning", "info"] as AuditSeverity[]).map((sev) => {
            const list = open.filter((i) => i.severity === sev);
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
                          <p className="text-xs text-muted">{t(`why.${i.code}`)}</p>
                          {f && <p className="num text-xs text-muted">{fd(f.date)} · {f.isFstd ? "FSTD" : `${f.depIcao} → ${f.arrIcao}`} · {f.registration ?? ""}</p>}
                        </div>
                        <span className="flex gap-2 self-start">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => explain(i)}>{t("explain")}</button>
                          <Link href={{ pathname: "/app/carnet/[id]", params: { id: i.flightId } }} className="btn btn-secondary btn-sm">{t("open")}</Link>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
          {done.length > 0 && (
            <Card title={`${t("explainedTitle")} · ${done.length}`} pad={false}>
              <ul className="divide-y divide-border">
                {done.slice(0, 200).map((i, n) => {
                  const e = explained[auditKey(i, byId.get(i.flightId))]!;
                  const f = byId.get(i.flightId);
                  return (
                    <li key={`x-${i.flightId}-${i.code}-${n}`} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{t(`codes.${i.code}`, (i.params ?? {}) as Record<string, string>)}</p>
                        <p className="text-xs text-muted">{f ? `${fd(f.date)} · ${f.depIcao} → ${f.arrIcao} · ` : ""}{t("explainedNote", { note: e.note, date: fd(e.at.slice(0, 10)) })}</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm self-start"
                        onClick={() => {
                          const next = { ...explained };
                          delete next[auditKey(i, byId.get(i.flightId))];
                          saveExplained(next);
                        }}
                      >
                        {t("unexplain")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
