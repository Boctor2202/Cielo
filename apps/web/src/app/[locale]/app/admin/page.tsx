"use client";

import { Check, Loader2, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, PageTitle, Readout, Segmented } from "@/components/app/ui";
import { useCloud } from "@/lib/cloud";
import { apiFetch } from "@/lib/report";

type Tab = "overview" | "users" | "reports" | "platform";

interface Overview {
  pilots: number;
  signups7: number;
  signups30: number;
  signupsPerDay: { date: string; n: number }[];
  paying: { total: number; basic: number; max: number; stripe: number; apple: number; google: number };
  trials: number;
  comped: number;
  canceled30: number;
  mrr: number;
  active7: number;
  flights: number;
  openReports: number;
  thresholds: Thresholds;
}
interface Thresholds {
  year: number;
  turnover: number;
  webTotal: number;
  storeProceeds: number;
  unknownCountry: number;
  items: { key: "micro" | "vat" | "oss"; value: number; limit: number; limitMax: number | null; projected: number; ratio: number; level: "ok" | "warning" | "over" }[];
}
interface User {
  id: string;
  email?: string;
  full_name?: string;
  created_at: string;
  subscription_tier: "free" | "basic" | "premium";
  subscription_source?: string | null;
  subscription_expires_at?: string | null;
  flights: number;
  lastActivity?: string | null;
  subscription?: { source: string; tier: string; status: string; current_period_end?: string | null } | null;
}
interface Report {
  id: string;
  created_at: string;
  updated_at: string;
  kind: "bug" | "idea" | "error";
  message: string;
  page?: string;
  platform?: string;
  app_version?: string;
  user_agent?: string;
  context?: Record<string, unknown>;
  status: "new" | "in_progress" | "resolved" | "ignored";
  occurrences: number;
  reporter?: { email?: string; full_name?: string } | null;
}

/** Back office, for the accounts listed in ADMIN_USER_IDS (checked by every /api/admin route). */
export default function AdminPage() {
  const t = useTranslations("app.admin");
  const cloud = useCloud();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!cloud.session) return setAllowed(false);
    apiFetch("/api/admin/me")
      .then((r) => setAllowed(r.ok))
      .catch(() => setAllowed(false));
  }, [cloud.session]);

  if (allowed === null) return <p className="text-muted">…</p>;
  if (!allowed)
    return (
      <Card className="mx-auto mt-10 max-w-md text-center">
        <ShieldCheck className="mx-auto text-muted" size={32} />
        <p className="mt-3 text-sm text-muted">{t("denied")}</p>
      </Card>
    );

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: t("tabs.overview") },
            { value: "users", label: t("tabs.users") },
            { value: "reports", label: t("tabs.reports") },
            { value: "platform", label: t("tabs.platform") },
          ]}
        />
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "platform" && <PlatformTab />}
    </>
  );
}

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false);
    apiFetch(path)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError(true));
  }, [path]);
  useEffect(load, [load]);
  return { data, error, reload: load };
}

function OverviewTab() {
  const t = useTranslations("app.admin.overview");
  const locale = useLocale();
  const { data, error } = useApi<Overview>("/api/admin/overview");
  const eur = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(n);
  if (error) return <p className="text-warning">{t("error")}</p>;
  if (!data) return <Loader2 className="animate-spin text-muted" />;
  const max = Math.max(1, ...data.signupsPerDay.map((d) => d.n));
  const alerts = data.thresholds.items.filter((i) => i.level !== "ok");
  return (
    <div className="space-y-5">
      {alerts.map((a) => (
        <div key={a.key} className={`rounded-2xl px-4 py-3 text-sm ${a.level === "over" ? "bg-warning/15 text-warning" : "bg-caution/15"}`}>
          ⚠️ {t(`thresholds.alert.${a.key}`, { value: eur(a.value), limit: eur(a.limit), projected: eur(a.projected) })}
        </div>
      ))}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Readout label={t("mrr")} value={eur(data.mrr)} sub={t("mrrSub", { basic: data.paying.basic, max: data.paying.max })} level="ok" />
        <Readout label={t("paying")} value={data.paying.total} sub={t("sources", { stripe: data.paying.stripe, apple: data.paying.apple, google: data.paying.google })} />
        <Readout label={t("trials")} value={data.trials} sub={t("comped", { n: data.comped })} level="caution" />
        <Readout label={t("pilots")} value={data.pilots} sub={t("signups", { d7: data.signups7, d30: data.signups30 })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Readout label={t("active7")} value={data.active7} level="neutral" />
        <Readout label={t("flights")} value={data.flights.toLocaleString(locale)} level="neutral" />
        <Readout label={t("openReports")} value={data.openReports} sub={t("canceled", { n: data.canceled30 })} level={data.openReports ? "warning" : "neutral"} />
      </div>
      <ThresholdsCard data={data.thresholds} eur={eur} />
      <Card title={t("signupsChart")}>
        <div className="flex h-36 items-end gap-1">
          {data.signupsPerDay.map((d) => (
            <div key={d.date} className="group relative flex-1" title={`${d.date} · ${d.n}`}>
              <div className="rounded-t bg-accent/80" style={{ height: `${Math.max(2, (d.n / max) * 130)}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{data.signupsPerDay[0]?.date}</span>
          <span>{data.signupsPerDay.at(-1)?.date}</span>
        </div>
      </Card>
    </div>
  );
}

function ThresholdsCard({ data, eur }: { data: Thresholds; eur: (n: number) => string }) {
  const t = useTranslations("app.admin.overview.thresholds");
  return (
    <Card title={t("title", { year: data.year })}>
      <div className="space-y-5">
        {data.items.map((i) => {
          const color = i.level === "over" ? "bg-warning" : i.level === "warning" ? "bg-caution" : "bg-accent";
          return (
            <div key={i.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{t(`${i.key}.label`)}</span>
                <span className="num">
                  {eur(i.value)} <span className="text-muted">/ {eur(i.limit)}{i.limitMax ? ` (${t("tolerance", { max: eur(i.limitMax) })})` : ""}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, i.ratio * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {t(`${i.key}.help`)} · {t("projected", { amount: eur(i.projected) })}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-muted">
        {t("detail", { web: eur(data.webTotal), stores: eur(data.storeProceeds) })}
        {data.unknownCountry > 0 ? ` ${t("unknownCountry", { amount: eur(data.unknownCountry) })}` : ""} {t("disclaimer")}
      </p>
    </Card>
  );
}

function UsersTab() {
  const t = useTranslations("app.admin.users");
  const tp = useTranslations("app.plans");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, reload } = useApi<{ users: User[] }>(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  const [busy, setBusy] = useState<string | null>(null);
  const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const grant = async (u: User, tier: "basic" | "premium" | "free") => {
    if (tier !== "free" && !confirm(t("confirmGrant", { plan: tp(tier), who: u.email ?? u.id }))) return;
    if (tier === "free" && !confirm(t("confirmRevoke", { who: u.email ?? u.id }))) return;
    setBusy(u.id);
    await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ pilotId: u.id, tier }) });
    setBusy(null);
    reload();
  };
  return (
    <Card pad={false}>
      <form
        className="flex gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-secondary" type="submit">{t("searchBtn")}</button>
      </form>
      {error && <p className="px-4 pb-4 text-warning">{t("error")}</p>}
      {!data && !error && <Loader2 className="m-4 animate-spin text-muted" />}
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-4 py-2 font-medium">{t("pilot")}</th>
                <th className="px-4 py-2 font-medium">{t("plan")}</th>
                <th className="px-4 py-2 font-medium">{t("store")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("flights")}</th>
                <th className="px-4 py-2 font-medium">{t("signedUp")}</th>
                <th className="px-4 py-2 font-medium">{t("lastActivity")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-t border-border/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted">{u.email ?? u.id}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.subscription_tier === "premium" ? "bg-accent/15 text-accent" : u.subscription_tier === "basic" ? "bg-chart-2/15 text-chart-2" : "bg-surface-2 text-muted"}`}>{tp(u.subscription_tier)}</span>
                    {u.subscription_tier !== "free" && !u.subscription && <span className="ml-1.5 text-[11px] text-muted">{t("comped")}</span>}
                    {u.subscription_expires_at && <p className="mt-0.5 text-[11px] text-muted">{t("until", { date: date(u.subscription_expires_at) })}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{u.subscription ? `${u.subscription.source} · ${u.subscription.status}` : "—"}</td>
                  <td className="num px-4 py-2.5 text-right">{u.flights}</td>
                  <td className="px-4 py-2.5 text-xs">{date(u.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs">{date(u.lastActivity)}</td>
                  <td className="px-4 py-2.5">
                    <select className="input !w-auto !py-1 text-xs" value="" disabled={busy === u.id} onChange={(e) => e.target.value && void grant(u, e.target.value as "basic" | "premium" | "free")} aria-label={t("action")}>
                      <option value="">{t("action")}</option>
                      <option value="premium">{t("grant", { plan: tp("premium") })}</option>
                      <option value="basic">{t("grant", { plan: tp("basic") })}</option>
                      <option value="free">{t("revoke")}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.users.length === 0 && <p className="p-4 text-sm text-muted">{t("none")}</p>}
        </div>
      )}
      <p className="px-4 py-3 text-[11px] text-muted">{t("compNote")}</p>
    </Card>
  );
}

function ReportsTab() {
  const t = useTranslations("app.admin.reports");
  const locale = useLocale();
  const [scope, setScope] = useState<"open" | "all">("open");
  const [kind, setKind] = useState<"" | "bug" | "idea" | "error">("");
  const { data, error, reload } = useApi<{ items: Report[] }>(`/api/admin/feedback?status=${scope}${kind ? `&kind=${kind}` : ""}`);
  const [open, setOpen] = useState<string | null>(null);
  const setStatus = async (r: Report, status: Report["status"]) => {
    await apiFetch("/api/admin/feedback", { method: "PATCH", body: JSON.stringify({ id: r.id, status }) });
    reload();
  };
  const kinds = useMemo(() => ({ bug: "🐞", idea: "💡", error: "⚠️" }), []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={scope} onChange={setScope} options={[{ value: "open", label: t("open") }, { value: "all", label: t("all") }]} />
        <select className="input !w-auto" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="">{t("allKinds")}</option>
          <option value="bug">{t("kind.bug")}</option>
          <option value="idea">{t("kind.idea")}</option>
          <option value="error">{t("kind.error")}</option>
        </select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload}><RefreshCw size={14} /></button>
      </div>
      {error && <p className="text-warning">{t("error")}</p>}
      {!data && !error && <Loader2 className="animate-spin text-muted" />}
      {data?.items.length === 0 && <Card><p className="text-sm text-muted">{t("none")}</p></Card>}
      {data?.items.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <p className="text-xs text-muted">
                {kinds[r.kind]} {t(`kind.${r.kind}`)} · {new Date(r.updated_at).toLocaleString(locale)} · {r.platform}
                {r.occurrences > 1 ? ` · ×${r.occurrences}` : ""} · {r.reporter?.email ?? t("anonymous")}
              </p>
              <p className={`mt-1 whitespace-pre-wrap ${open === r.id ? "" : "line-clamp-3"}`}>{r.message}</p>
              {r.page && <p className="num mt-1 text-xs text-muted">{r.page}</p>}
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "new" ? "bg-warning/15 text-warning" : r.status === "in_progress" ? "bg-caution/15 text-caution" : "bg-surface-2 text-muted"}`}>{t(`status.${r.status}`)}</span>
              {r.status !== "in_progress" && r.status !== "resolved" && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(r, "in_progress")}>{t("take")}</button>}
              {r.status !== "resolved" && <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(r, "resolved")}><Check size={14} /> {t("resolve")}</button>}
              {r.status === "new" && <button type="button" className="btn btn-ghost btn-sm" title={t("ignore")} onClick={() => setStatus(r, "ignored")}><X size={14} /></button>}
            </div>
          </div>
          {open === r.id && (
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-surface-2/60 p-3 text-[11px] leading-relaxed">{JSON.stringify({ version: r.app_version, userAgent: r.user_agent, ...r.context }, null, 2)}</pre>
          )}
        </Card>
      ))}
    </div>
  );
}

function PlatformTab() {
  const t = useTranslations("app.admin.platform");
  const { data, error, reload } = useApi<{ flags: Record<string, boolean>; services: { key: string; ok: boolean; note?: string }[] }>("/api/admin/flags");
  const toggle = async (key: string, enabled: boolean) => {
    await apiFetch("/api/admin/flags", { method: "PUT", body: JSON.stringify({ key, enabled }) });
    reload();
  };
  if (error) return <p className="text-warning">{t("error")}</p>;
  if (!data) return <Loader2 className="animate-spin text-muted" />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={t("features")}>
        <p className="mb-4 text-xs text-muted">{t("featuresHelp")}</p>
        <ul className="space-y-3">
          {Object.entries(data.flags).map(([k, on]) => (
            <li key={k} className="flex items-center justify-between gap-3">
              <span>{t(`flag.${k}`)}</span>
              <button type="button" role="switch" aria-checked={on} onClick={() => toggle(k, !on)} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-2"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t("services")}>
        <ul className="space-y-2.5 text-sm">
          {data.services.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <span>{t(`service.${s.key}`)}</span>
              <span className={`text-xs font-semibold ${s.ok ? "text-success" : "text-caution"}`}>{s.ok ? (s.note ?? t("ok")) : (s.note ?? t("missing"))}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">{t("servicesHelp")}</p>
      </Card>
    </div>
  );
}
