"use client";

import { Check, Copy, Eye, Loader2, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, PageTitle, Readout, Segmented } from "@/components/app/ui";
import { useCloud } from "@/lib/cloud";
import { apiFetch } from "@/lib/report";

type Tab = "overview" | "users" | "apis" | "reports" | "platform";

interface Overview {
  pilots: number;
  signups7: number;
  signups30: number;
  signupsPerDay: { date: string; n: number }[];
  paying: { total: number; basic: number; max: number; stripe: number; apple: number; google: number };
  trials: number;
  trialsEnded: number;
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
  subscription?: { source: string; tier: string; status: string } | null;
  stage: Stage;
  test?: boolean;
  since: string;
  trialEndsAt?: string;
  renewsAt?: string | null;
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
            { value: "apis", label: t("tabs.apis") },
            { value: "reports", label: t("tabs.reports") },
            { value: "platform", label: t("tabs.platform") },
          ]}
        />
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "apis" && <ApisTab />}
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
        <Readout label={t("trials")} value={data.trials} sub={t("comped", { n: data.comped, ended: data.trialsEnded })} level="caution" />
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

type Stage = "trial" | "paying" | "ended" | "canceled" | "comped";

function useDates() {
  const locale = useLocale();
  const t = useTranslations("app.admin.users");
  const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const days = (s?: string | null) => (s ? Math.floor((Date.now() - Date.parse(s)) / 86400_000) : null);
  /** "today", "3 d ago", "in 5 d" */
  const ago = (s?: string | null) => {
    const d = days(s);
    if (d === null) return "—";
    if (d === 0) return t("today");
    return d > 0 ? t("daysAgo", { n: d }) : t("inDays", { n: -d });
  };
  return { date, ago, days };
}

function StageBadge({ stage }: { stage: Stage }) {
  const t = useTranslations("app.admin.users.stage");
  const tone = { paying: "bg-accent/15 text-accent", trial: "bg-chart-2/15 text-chart-2", ended: "bg-surface-2 text-muted", canceled: "bg-warning/15 text-warning", comped: "bg-caution/15 text-caution" }[stage];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{t(stage)}</span>;
}

function PlanAction({ u, busy, grant }: { u: User; busy: boolean; grant: (u: User, tier: "basic" | "premium" | "free" | "test" | "untest") => void }) {
  const t = useTranslations("app.admin.users");
  const tp = useTranslations("app.plans");
  return (
    <select className="input !w-auto !py-1 text-xs" value="" disabled={busy} onChange={(e) => e.target.value && grant(u, e.target.value as "basic" | "premium" | "free" | "test" | "untest")} aria-label={t("action")}>
      <option value="">{t("action")}</option>
      <option value="premium">{t("grant", { plan: tp("premium") })}</option>
      <option value="basic">{t("grant", { plan: tp("basic") })}</option>
      <option value="free">{t("revoke")}</option>
      {u.test ? <option value="untest">{t("untest")}</option> : <option value="test">{t("markTest")}</option>}
    </select>
  );
}

function UsersTab() {
  const t = useTranslations("app.admin.users");
  const tp = useTranslations("app.plans");
  const locale = useLocale();
  const { date, ago } = useDates();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Exclude<Stage, "comped">>("all");
  const { data, error, reload } = useApi<{ users: User[]; adminsHidden: number }>(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  const [busy, setBusy] = useState<string | null>(null);
  const grant = async (u: User, tier: "basic" | "premium" | "free" | "test" | "untest") => {
    setBusy(u.id);
    if (tier === "test" || tier === "untest") {
      const r = await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ pilotId: u.id, test: tier === "test" }) });
      if (!r.ok) alert(t("testError"));
    } else {
      if (tier !== "free" && !confirm(t("confirmGrant", { plan: tp(tier), who: u.email ?? u.id }))) return setBusy(null);
      if (tier === "free" && !confirm(t("confirmRevoke", { who: u.email ?? u.id }))) return setBusy(null);
      await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ pilotId: u.id, tier }) });
    }
    setBusy(null);
    reload();
  };
  const [viewLink, setViewLink] = useState<{ who: string; link: string } | null>(null);
  const openAs = async (u: User) => {
    setBusy(u.id);
    const r = await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ pilotId: u.id, signIn: true, locale }) });
    setBusy(null);
    const j = r.ok ? ((await r.json()) as { link: string }) : null;
    if (!j?.link) return alert(t("viewError"));
    await navigator.clipboard?.writeText(j.link).catch(() => null);
    setViewLink({ who: u.full_name || u.email || u.id, link: j.link });
  };
  const real = (data?.users ?? []).filter((u) => !u.test);
  const tests = (data?.users ?? []).filter((u) => u.test);
  const subscribers = real.filter((u) => u.stage !== "comped");
  const comped = real.filter((u) => u.stage === "comped");
  const count = (s: Stage) => subscribers.filter((u) => u.stage === s).length;
  const shown = filter === "all" ? subscribers : subscribers.filter((u) => u.stage === filter);
  const who = (u: User) => (
    <>
      <p className="font-medium">{u.full_name || "—"}</p>
      <p className="text-xs text-muted">{u.email ?? u.id}</p>
    </>
  );
  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
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
      {error && <p className="text-warning">{t("error")}</p>}
      {!data && !error && <Loader2 className="animate-spin text-muted" />}
      {data && (
        <>
          <Card pad={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <h2 className="font-semibold">{t("subscribers", { n: subscribers.length })}</h2>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "trial", "paying", "ended", "canceled"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f ? "bg-accent text-black" : "bg-surface-2 text-muted hover:text-text"}`}>
                    {f === "all" ? t("all") : t(`stage.${f}`)} · {f === "all" ? subscribers.length : count(f)}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="px-4 py-2 font-medium">{t("pilot")}</th>
                    <th className="px-4 py-2 font-medium">{t("phase")}</th>
                    <th className="px-4 py-2 font-medium">{t("since")}</th>
                    <th className="px-4 py-2 font-medium">{t("next")}</th>
                    <th className="px-4 py-2 font-medium">{t("lastActivity")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("flights")}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => (
                    <tr key={u.id} className="border-t border-border/50">
                      <td className="px-4 py-2.5">{who(u)}</td>
                      <td className="px-4 py-2.5">
                        <StageBadge stage={u.stage} />
                        <p className="mt-1 text-[11px] text-muted">
                          {u.subscription ? `${tp(u.subscription.tier as "basic" | "premium")} · ${t(`source.${u.subscription.source}`)}` : u.stage === "trial" ? t("noCard") : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <p>{date(u.since)}</p>
                        <p className="text-muted">{ago(u.since)}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {u.stage === "trial" && u.trialEndsAt ? (
                          <>
                            <p>{t("trialEnds")}</p>
                            <p className="text-muted">{date(u.trialEndsAt)} · {ago(u.trialEndsAt)}</p>
                          </>
                        ) : u.stage === "paying" && u.renewsAt ? (
                          <>
                            <p>{u.subscription?.status === "canceling" ? t("endsOn") : t("renews")}</p>
                            <p className="text-muted">{date(u.renewsAt)}</p>
                          </>
                        ) : u.stage === "ended" && u.trialEndsAt ? (
                          <p className="text-muted">{t("trialEnded", { date: date(u.trialEndsAt) })}</p>
                        ) : u.stage === "canceled" ? (
                          <p className="text-muted">{u.subscription ? t(`status.${u.subscription.status}`) : "—"}</p>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <p>{ago(u.lastActivity)}</p>
                        <p className="text-muted">{date(u.lastActivity)}</p>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{u.flights}</td>
                      <td className="px-4 py-2.5"><PlanAction u={u} busy={busy === u.id} grant={(x, tier) => void grant(x, tier)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length === 0 && <p className="p-4 text-sm text-muted">{t("none")}</p>}
            </div>
            {data.adminsHidden > 0 && <p className="px-4 py-3 text-[11px] text-muted">{t("adminsHidden", { n: data.adminsHidden })}</p>}
          </Card>

          <Card pad={false}>
            <div className="p-4">
              <h2 className="font-semibold">{t("compedTitle", { n: comped.length })}</h2>
              <p className="mt-1 text-xs text-muted">{t("compNote")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="px-4 py-2 font-medium">{t("pilot")}</th>
                    <th className="px-4 py-2 font-medium">{t("plan")}</th>
                    <th className="px-4 py-2 font-medium">{t("signedUp")}</th>
                    <th className="px-4 py-2 font-medium">{t("lastActivity")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("flights")}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {comped.map((u) => (
                    <tr key={u.id} className="border-t border-border/50">
                      <td className="px-4 py-2.5">{who(u)}</td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${u.subscription_tier === "premium" ? "bg-accent/15 text-accent" : "bg-chart-2/15 text-chart-2"}`}>{tp(u.subscription_tier)}</span>
                        <p className="mt-1 text-muted">{u.subscription_expires_at ? t("until", { date: date(u.subscription_expires_at) }) : t("noEnd")}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{date(u.created_at)}</td>
                      <td className="px-4 py-2.5 text-xs">
                        <p>{ago(u.lastActivity)}</p>
                        <p className="text-muted">{date(u.lastActivity)}</p>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{u.flights}</td>
                      <td className="px-4 py-2.5"><PlanAction u={u} busy={busy === u.id} grant={(x, tier) => void grant(x, tier)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {comped.length === 0 && <p className="p-4 text-sm text-muted">{t("noneComped")}</p>}
            </div>
          </Card>

          {viewLink && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setViewLink(null)}>
              <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold">{t("viewTitle", { who: viewLink.who })}</h3>
                <p className="mt-2 text-sm text-muted">{t("viewHelp")}</p>
                <input readOnly className="input mt-4 font-mono text-xs" value={viewLink.link} onFocus={(e) => e.currentTarget.select()} />
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard?.writeText(viewLink.link)}>
                    <Copy size={14} /> {t("viewCopy")}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setViewLink(null)}>{t("viewDone")}</button>
                </div>
              </div>
            </div>
          )}

          {tests.length > 0 && (
            <details className="card group">
              <summary className="cursor-pointer list-none p-4 font-semibold">
                {t("testTitle", { n: tests.length })} <span className="ml-1 text-xs font-normal text-muted">{t("testNote")}</span>
              </summary>
              <ul className="border-t border-border/50">
                {tests.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 border-b border-border/30 px-4 py-2.5 text-sm last:border-0">
                    <div>{who(u)}</div>
                    <div className="flex items-center gap-3">
                      <StageBadge stage={u.stage} />
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy === u.id} onClick={() => void openAs(u)}>
                        <Eye size={14} /> {t("viewAs")}
                      </button>
                      <PlanAction u={u} busy={busy === u.id} grant={(x, tier) => void grant(x, tier)} />
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

interface Usage {
  ready: boolean;
  reason?: string;
  since: string | null;
  services: { service: string; calls: number; callsToday: number; errors: number; input: number; output: number; costUsd: number; actual: boolean; projectedUsd: number; lastMonthUsd: number; lastMonthCalls: number; ops: { op: string; calls: number; errors: number; input: number; output: number; costUsd: number }[]; quota: { perDay?: number; perMonth?: number } | null }[];
  perDay: { date: string; calls: number; costUsd: number }[];
  fixed: { key: string; usd: number }[];
  totals: { variableUsd: number; projectedUsd: number; lastMonthUsd: number; fixedUsd: number };
}

function ApisTab() {
  const t = useTranslations("app.admin.apis");
  const locale = useLocale();
  const { data, error, reload } = useApi<Usage>("/api/admin/usage");
  const [open, setOpen] = useState<string | null>(null);
  const usd = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: n > 0 && n < 1 ? 3 : 2 }).format(n);
  const num = (n: number) => Math.round(n).toLocaleString(locale);
  const tok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `${(n / 1e3).toLocaleString(locale, { maximumFractionDigits: 0 })} k` : String(n));
  if (error) return <p className="text-warning">{t("error")}</p>;
  if (!data) return <Loader2 className="animate-spin text-muted" />;
  if (!data.ready) return <Card><p className="text-sm text-muted">{t("notReady")}</p></Card>;
  const max = Math.max(1, ...data.perDay.map((d) => d.calls));
  const calls = data.services.reduce((s, x) => s + x.calls, 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Readout label={t("month")} value={usd(data.totals.variableUsd)} sub={t("monthSub")} />
        <Readout label={t("projected")} value={usd(data.totals.projectedUsd)} sub={t("projectedSub", { fixed: usd(data.totals.fixedUsd) })} level="caution" />
        <Readout label={t("lastMonth")} value={usd(data.totals.lastMonthUsd)} sub={t("lastMonthSub")} level="neutral" />
        <Readout label={t("calls")} value={num(calls)} sub={data.since ? t("countedSince", { date: new Date(data.since).toLocaleDateString(locale) }) : t("noData")} level="neutral" />
      </div>
      <Card title={t("chart")}>
        <div className="flex h-32 items-end gap-1">
          {data.perDay.map((d) => (
            <div key={d.date} className="flex-1" title={`${d.date} · ${num(d.calls)} · ${usd(d.costUsd)}`}>
              <div className="rounded-t bg-accent/80" style={{ height: `${Math.max(2, (d.calls / max) * 120)}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{data.perDay[0]?.date}</span>
          <span>{data.perDay.at(-1)?.date}</span>
        </div>
      </Card>
      <Card pad={false}>
        <div className="flex items-center justify-between p-4">
          <h2 className="font-semibold">{t("services")}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reload}><RefreshCw size={14} /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-4 py-2 font-medium">{t("service")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("callsMonth")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("today")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("errors")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("cost")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("projection")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("prev")}</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((s) => {
                const quota = s.quota?.perDay ? s.callsToday / s.quota.perDay : s.quota?.perMonth ? s.calls / s.quota.perMonth : 0;
                return (
                  <Fragment key={s.service}>
                    <tr className="cursor-pointer border-t border-border/50 hover:bg-surface-2/40" onClick={() => setOpen(open === s.service ? null : s.service)}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{t(`name.${s.service}`)}</p>
                        <p className="text-[11px] text-muted">
                          {t(`what.${s.service}`)}
                          {s.service === "anthropic" && s.input ? ` · ${t("tokens", { in: tok(s.input), out: tok(s.output) })}` : ""}
                        </p>
                        {s.quota && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                              <div className={`h-full rounded-full ${quota > 0.9 ? "bg-warning" : quota > 0.6 ? "bg-caution" : "bg-accent"}`} style={{ width: `${Math.min(100, quota * 100)}%` }} />
                            </div>
                            <span className="text-[11px] text-muted">{s.quota.perDay ? t("quotaDay", { n: num(s.callsToday), max: num(s.quota.perDay) }) : t("quotaMonth", { n: num(s.calls), max: num(s.quota.perMonth ?? 0) })}</span>
                          </div>
                        )}
                      </td>
                      <td className="num px-4 py-2.5 text-right">{num(s.calls)}</td>
                      <td className="num px-4 py-2.5 text-right">{num(s.callsToday)}</td>
                      <td className={`num px-4 py-2.5 text-right ${s.errors ? "text-warning" : "text-muted"}`}>{num(s.errors)}</td>
                      <td className="num px-4 py-2.5 text-right font-semibold">
                        {usd(s.costUsd)}
                        <p className="text-[10px] font-normal text-muted">{s.actual ? t("actual") : t(`basis.${s.service}`)}</p>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{usd(s.projectedUsd)}</td>
                      <td className="num px-4 py-2.5 text-right text-muted">{usd(s.lastMonthUsd)}</td>
                    </tr>
                    {open === s.service && s.ops.length > 0 && (
                      <tr className="bg-surface-2/30">
                        <td colSpan={7} className="px-4 py-2">
                          <ul className="space-y-1 text-xs">
                            {s.ops.map((o) => (
                              <li key={o.op} className="flex justify-between gap-3">
                                <span>{t.has(`op.${o.op}`) ? t(`op.${o.op}`) : o.op}</span>
                                <span className="num text-muted">
                                  {num(o.calls)} {t("callsShort")}
                                  {o.errors ? ` · ${num(o.errors)} ${t("errorsShort")}` : ""}
                                  {o.input ? ` · ${tok(o.input)} / ${tok(o.output)} tokens · ${usd(o.costUsd)}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={t("fixedTitle")}>
        <ul className="space-y-2 text-sm">
          {data.fixed.map((f) => (
            <li key={f.key} className="flex justify-between gap-3">
              <span>{t(`fixed.${f.key}`)}</span>
              <span className="num">{t("perMonth", { amount: usd(f.usd) })}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">{t("disclaimer")}</p>
      </Card>
    </div>
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
      <AdsbCheck />
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

/** Which open aircraft database knows a registration (for an aircraft the ADS-B lookup cannot find). */
function AdsbCheck() {
  const t = useTranslations("app.admin.platform.adsb");
  const [reg, setReg] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ source: string; hex: string | null; error?: string; ms: number }[] | null>(null);
  const [extra, setExtra] = useState<{ adsb: unknown; fa: unknown } | null>(null);
  const [withFa, setWithFa] = useState(false);
  const run = async () => {
    setBusy(true);
    setRes(null);
    setExtra(null);
    const r = await apiFetch(`/api/admin/adsb-check?reg=${encodeURIComponent(reg.trim())}${withFa ? "&fa=1" : ""}`).catch(() => null);
    const d = r?.ok ? ((await r.json()) as { sources: NonNullable<typeof res>; adsb: unknown; fa: unknown }) : null;
    setRes(d?.sources ?? []);
    if (d) setExtra({ adsb: d.adsb, fa: d.fa });
    setBusy(false);
  };
  return (
    <Card title={t("title")} className="lg:col-span-2">
      <p className="mb-3 text-xs text-muted">{t("help")}</p>
      <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), void run())}>
        <input className="input num !w-40 uppercase" placeholder="9H-AST" value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} />
        <button type="submit" className="btn btn-secondary" disabled={busy || reg.trim().length < 3}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} {t("check")}</button>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={withFa} onChange={(e) => setWithFa(e.target.checked)} /> {t("withFa")}
        </label>
      </form>
      {res && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {res.length === 0 && <li className="text-warning">{t("error")}</li>}
          {res.map((s) => (
            <li key={s.source} className="flex justify-between gap-3">
              <span>{s.source}</span>
              <span className={`num text-xs ${s.hex ? "font-semibold text-success" : "text-muted"}`}>{s.hex ? s.hex.toUpperCase() : s.error ? `${t("failed")} (${s.error})` : t("unknown")} · {s.ms} ms</span>
            </li>
          ))}
        </ul>
      )}
      {extra && (extra.adsb !== null || extra.fa !== null) && (
        <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-surface-2/60 p-3 text-[11px] leading-relaxed">{JSON.stringify({ adsbTodayYesterday: extra.adsb, flightaware: extra.fa }, null, 2)}</pre>
      )}
    </Card>
  );
}
