"use client";

import { AlertTriangle, ArrowRight, NotebookPen, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  addDays, analyseFtl, auditLogbook, buildDutyPeriods, computeRecency, cumulativeLevel, dashboardPeriods, FTL_LIMITS, licenseStatus,
} from "@cielo/core";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge, Card, Empty, Meter, PageTitle, Readout, type Level } from "@/components/app/ui";
import { HoursBars } from "@/components/app/Charts";
import { useAirports } from "@/lib/airports";
import { useDuration, useFlights, useFormatDate, usePilot, useTable, useToday } from "@/lib/hooks";
import { loadDemo } from "@/lib/demo";
import { GlassCockpit } from "@/components/app/GlassCockpit";

export default function Dashboard() {
  const t = useTranslations("app.dashboard");
  const tl = useTranslations("app.documents");
  const tf = useTranslations("app.ftl");
  const tn = useTranslations("app.nav");
  const locale = useLocale() as "fr" | "en";
  const router = useRouter();
  const flights = useFlights();
  const balances = useTable("opening_balances");
  const licenses = useTable("licenses");
  const pilot = usePilot();
  const airports = useAirports();
  const today = useToday();
  const d = useDuration();
  const fd = useFormatDate();
  const [busy, setBusy] = useState(false);

  const data = useMemo(() => {
    if (!flights || !balances) return null;
    const periods = dashboardPeriods(flights, balances, today);
    const recency = computeRecency(flights, today);
    const months: { label: string; minutes: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - i, 1));
      const key = dt.toISOString().slice(0, 7);
      months.push({
        label: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(dt).replace(".", ""),
        minutes: flights.filter((f) => f.date.startsWith(key)).reduce((s, f) => s + f.totalMin, 0),
      });
    }
    const ftl = analyseFtl(buildDutyPeriods(flights), new Date().toISOString());
    const issues = airports ? auditLogbook(flights, { today, airports: (c) => airports.get(c) }).filter((i) => i.severity === "error").length : 0;
    return { periods, recency, months, ftl, issues };
  }, [flights, balances, today, locale, airports]);

  const expiries = useMemo(
    () =>
      (licenses ?? [])
        .map((l) => ({ l, s: licenseStatus(l, today) }))
        .filter((x) => x.s.state !== "no_expiry")
        .sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0))
        .slice(0, 5),
    [licenses, today],
  );

  if (!flights || !data) return <p className="text-muted">…</p>;

  const name = pilot?.displayName || pilot?.fullName?.split(" ")[0] || "";
  const { periods: p, recency } = data;

  if (flights.length === 0 && (balances?.length ?? 0) === 0) {
    return (
      <>
        <PageTitle title={name ? t("hello", { name }) : t("empty")} subtitle={t("today", { date: fd(today, { dateStyle: "full" }) })} />
        <Card>
          <Empty
            icon={<NotebookPen size={40} />}
            text={t("empty")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/app/carnet/nouveau" className="btn btn-primary">
                  <Plus size={18} /> {t("emptyCta")}
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!airports || busy}
                  onClick={async () => {
                    setBusy(true);
                    await loadDemo(airports!, locale);
                    setBusy(false);
                    router.refresh();
                  }}
                >
                  {t("loadDemo")}
                </button>
              </div>
            }
          />
        </Card>
      </>
    );
  }


  return (
    <>
      {data.issues > 0 && (
        <Link href="/app/carnet/audit" className="mb-5 flex items-center gap-3 rounded-xl border border-caution/40 bg-caution/10 px-4 py-3 text-sm font-medium text-caution">
          <AlertTriangle size={18} /> {t("auditIssues", { count: data.issues })} <ArrowRight size={16} className="ml-auto" />
        </Link>
      )}
      <GlassCockpit flights={flights} opening={balances ?? []} licenses={licenses ?? []} pilot={pilot} today={today} />
    </>
  );
}

function RecencyRow({ label, ok, text, warn }: { label: string; ok: boolean; text: string; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-sm text-muted">{text}</p>
      </div>
      <Badge level={!ok ? "warning" : warn ? "caution" : "ok"}>{ok ? "OK" : "—"}</Badge>
    </div>
  );
}
