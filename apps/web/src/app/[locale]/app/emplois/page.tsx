"use client";

import { Briefcase, Check, ExternalLink, HelpCircle, Lock, MapPin, Plane, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Roll } from "@/components/ui/Roll";
import { useLocale, useTranslations } from "next-intl";
import { buildProfile, defaultWorkRegions, detectAircraft, matchJob, REGIONS, authorityFromText, type Evaluation, type GapCode, type Job, type Match, type Position, type RegionId } from "@cielo/jobs";

import { Badge, Card, Empty, PageTitle, Segmented, Toggle, type Level } from "@/components/app/ui";
import { useFlights, useFormatDate, usePilot, useTable, useTypes } from "@/lib/hooks";
import { DEMO_META, localStore } from "@/lib/db";

/** operators not shown to the demo pilot */
const DEMO_HIDDEN = /aston\s*jet/i;

type Sort = "match" | "experience" | "salary" | "recent";
interface Feed {
  updatedAt: string;
  jobs: Job[];
  sources: { company: string; ok: boolean; pilotJobs: number }[];
}

const levelFor = (score: number): Level => (score >= 80 ? "ok" : score >= 55 ? "info" : "caution");
const RING: Record<Level, string> = { ok: "var(--success)", info: "var(--accent)", caution: "var(--caution)", warning: "var(--warning)", neutral: "var(--muted)" };

export default function JobsPage() {
  const t = useTranslations("app.jobs");
  const fd = useFormatDate();
  const flights = useFlights();
  const opening = useTable("opening_balances");
  const licenses = useTable("licenses");
  const types = useTypes();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<Sort>("match");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [onTypeOnly, setOnTypeOnly] = useState(false);
  const pilot = usePilot();
  // Where the pilot may work (citizenship, visas): saved on this device, defaults from the licence regime
  const [workRegions, setWorkRegions] = useState<RegionId[] | null>(null);
  // Which regions the list shows (a pure filter, saved on this device): none chosen = every region.
  // Independent of the work rights above, which only weigh on the match.
  const [regionFilter, setRegionFilter] = useState<RegionId[]>([]);
  const [editRights, setEditRights] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem("cielo-work-regions");
      if (v) setWorkRegions(JSON.parse(v));
      const f = localStorage.getItem("cielo-jobs-regions");
      if (f) setRegionFilter(JSON.parse(f));
    } catch {}
  }, []);
  const saveFilter = (r: RegionId[]) => {
    setRegionFilter(r);
    try {
      localStorage.setItem("cielo-jobs-regions", JSON.stringify(r));
    } catch {}
  };
  const saveWork = (r: RegionId[]) => {
    setWorkRegions(r);
    try {
      localStorage.setItem("cielo-work-regions", JSON.stringify(r));
    } catch {}
  };

  useEffect(() => {
    Promise.all([fetch("/api/jobs").then((r) => (r.ok ? r.json() : Promise.reject())), localStore.getMeta(DEMO_META)])
      // the demo pilot's matches leave out the operators of the people behind Geardown
      .then(([f, demo]: [Feed, string | undefined]) => setFeed(demo === "1" ? { ...f, jobs: f.jobs.filter((j) => !DEMO_HIDDEN.test(j.company)) } : f))
      .catch(() => setError(true));
  }, []);

  // The subscriber's experience, computed here from the local logbook (never sent anywhere)
  const profile = useMemo(() => {
    if (!flights || !opening || !licenses || !types) return null;
    const engine = new Map(types.map((x) => [x.icao, x.engineType]));
    return buildProfile(flights, opening, licenses, (i) => engine.get(i), (code) => detectAircraft(code), { framework: pilot?.regulatoryFramework, workRegions: workRegions ?? undefined });
  }, [flights, opening, licenses, types, pilot?.regulatoryFramework, workRegions]);
  const myRegions = profile?.workRegions ?? [];
  const hasLogbook = !!profile && profile.totalMin > 0;

  // every offer with its match, then each filter as a test: the counts of one filter apply the others
  const all = useMemo(() => (feed && profile ? feed.jobs.map((job) => ({ job, match: matchJob(job, profile) })) : []), [feed, profile]);
  type Row = (typeof all)[number];
  const byPosition = (r: Row, p: Position | "ALL" = position) => p === "ALL" || r.job.position === p;
  const byType = (r: Row, on = onTypeOnly) => !on || r.match.onType;
  const byRegion = (r: Row) => !regionFilter.length || regionFilter.includes(r.job.region);

  const rows = useMemo(() => {
    const list = all.filter((r) => byPosition(r) && byType(r) && byRegion(r));
    // offers without a published requirement go last when sorting by experience
    const exp = (j: Job) => j.requirements.totalHours ?? Number.POSITIVE_INFINITY;
    const sal = (j: Job) => j.salary?.annualEur ?? -1;
    list.sort((a, b) =>
      sort === "match" ? b.match.score - a.match.score || b.match.confidence - a.match.confidence
      : sort === "experience" ? (exp(a.job) === exp(b.job) ? 0 : exp(a.job) < exp(b.job) ? -1 : 1)
      : sort === "salary" ? sal(b.job) - sal(a.job)
      : (b.job.postedAt ?? "").localeCompare(a.job.postedAt ?? ""),
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, position, onTypeOnly, sort, regionFilter]);
  const counts = useMemo(() => {
    const pos = new Map<string, number>();
    const reg = new Map<string, number>();
    let typeN = 0;
    for (const r of all) {
      if (byType(r) && byRegion(r)) {
        pos.set(r.job.position, (pos.get(r.job.position) ?? 0) + 1);
        pos.set("ALL", (pos.get("ALL") ?? 0) + 1);
      }
      if (byPosition(r) && byType(r)) {
        reg.set(r.job.region, (reg.get(r.job.region) ?? 0) + 1);
        reg.set("ALL", (reg.get("ALL") ?? 0) + 1);
      }
      if (byPosition(r) && byRegion(r) && r.match.onType) typeN++;
    }
    return { pos, reg, typeN };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, position, onTypeOnly, regionFilter]);

  const positions = useMemo(() => [...new Set((feed?.jobs ?? []).map((j) => j.position))] as Position[], [feed]);
  const followed = feed?.sources.filter((s) => s.ok).length ?? 0;

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <p className="mb-5 flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
        <Lock size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {t("privacy")}
      </p>
      {!hasLogbook && profile && <p className="mb-5 rounded-lg border border-accent/30 bg-accent/8 px-4 py-3 text-sm">{t("noLogbook")}</p>}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-muted">{t("sort.label")}</span>
          <Segmented<Sort>
            value={sort}
            onChange={setSort}
            options={(["match", "experience", "salary", "recent"] as Sort[]).filter((s) => hasLogbook || s !== "match").map((s) => ({ value: s, label: t(`sort.${s}`) }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <select className="input !w-auto" value={position} onChange={(e) => setPosition(e.target.value as Position | "ALL")} aria-label={t("filter.position")}>
            <option value="ALL">{t("filter.position")} · {t("filter.all")}</option>
            {positions.map((p) => (
              <option key={p} value={p}>{t(`positions.${p}`)} ({counts.pos.get(p) ?? 0})</option>
            ))}
          </select>
          {hasLogbook && <Toggle checked={onTypeOnly} onChange={setOnTypeOnly} label={`${t("filter.onType")} (${counts.typeN})`} />}
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold">{t("regionFilter.title")}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("regionFilter.title")}>
          <button
            type="button"
            aria-pressed={!regionFilter.length}
            onClick={() => saveFilter([])}
            className={`min-h-9 cursor-pointer rounded-full border px-3 text-[13px] font-medium transition-colors ${!regionFilter.length ? "border-accent bg-accent/12 text-accent" : "border-border text-muted hover:border-accent/50 hover:text-text"}`}
          >
            {!regionFilter.length ? "✓ " : ""}{t("filter.allRegions")} <span className="num opacity-70">{counts.reg.get("ALL") ?? 0}</span>
          </button>
          {REGIONS.filter((r) => r !== "OTHER" || counts.reg.get(r)).map((r) => {
            const on = regionFilter.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => saveFilter(on ? regionFilter.filter((x) => x !== r) : [...regionFilter, r])}
                className={`min-h-9 cursor-pointer rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? "border-accent bg-accent/12 text-accent" : "border-border text-muted hover:border-accent/50 hover:text-text"}`}
              >
                {on ? "✓ " : ""}{t(`regions.${r}`)} <span className="num opacity-70">{counts.reg.get(r) ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 border-t border-border pt-3 text-xs text-muted">
          <p>
            {t("work.rightsLine", { regions: myRegions.map((r) => t(`regions.${r}`)).join(", ") || "—", authorities: profile?.authorities.join(", ") || "—" })}{" "}
            <button type="button" className="font-semibold text-accent underline" onClick={() => setEditRights((x) => !x)}>
              {editRights ? t("work.done") : t("work.edit")}
            </button>
          </p>
          {editRights ? (
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("work.title")}>
              {REGIONS.filter((r) => r !== "OTHER").map((r) => {
                const on = myRegions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => saveWork(on ? myRegions.filter((x) => x !== r) : [...myRegions, r])}
                    className={`min-h-8 cursor-pointer rounded-full border px-2.5 text-xs font-medium ${on ? "border-accent bg-accent/12 text-accent" : "border-border text-muted hover:text-text"}`}
                  >
                    {on ? "✓ " : ""}{t(`regions.${r}`)}
                  </button>
                );
              })}
            </div>
          ) : null}
          <p className="mt-1">{t("work.help2")}</p>
        </div>
      </div>

      {feed && profile ? (
        <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
          <span className="num text-2xl font-semibold text-text"><Roll>{String(rows.length)}</Roll></span>
          <span>{t("count.shown", { n: rows.length })}</span>
          {rows.length !== feed.jobs.length ? <span>· {t("count.total", { n: feed.jobs.length })}</span> : null}
        </p>
      ) : null}
      {error ? (
        <Card><Empty icon={<Briefcase size={36} />} text={t("error")} /></Card>
      ) : !feed || !profile ? (
        <p className="text-muted">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <Card><Empty icon={<Briefcase size={36} />} text={t("empty")} /></Card>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ job, match }, i) => (
            <JobCard key={`${job.id}-${i}`} job={job} match={match} showMatch={hasLogbook} />
          ))}
        </ul>
      )}

      {feed && (
        <p className="mt-6 text-xs text-muted">
          {t("updated", { date: fd(feed.updatedAt, { dateStyle: "medium", timeStyle: "short" }), count: followed })} · {t("sourceNote")}
          {feed.jobs.some((j) => j.source === "adzuna") && (
            <> · {t("adzunaNote")} <a href="https://www.adzuna.com" target="_blank" rel="noopener" className="underline">Jobs by Adzuna</a></>
          )}
        </p>
      )}
    </>
  );
}

function JobCard({ job, match, showMatch }: { job: Job; match: Match; showMatch: boolean }) {
  const t = useTranslations("app.jobs");
  const locale = useLocale();
  const fd = useFormatDate();
  const nf = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB");
  const r = job.requirements;
  const level = levelFor(match.score);

  const reqs: { code: GapCode; value: string }[] = [];
  if (r.licence) reqs.push({ code: "licence", value: `${r.authority ? r.authority + " " : ""}${(r.licenceAlternatives ?? [r.licence]).map((l) => (l === "FATPL" ? "ATPL (frozen)" : l)).join(" / ")}` });
  for (const k of ["totalHours", "picHours", "onTypeHours", "multiPilotHours", "jetHours", "turbineHours"] as const) {
    const v = r[k];
    if (v) reqs.push({ code: k, value: `${nf.format(v)} h` });
  }
  if (r.englishLevel) reqs.push({ code: "english", value: `≥ ${r.englishLevel}` });

  const salary = job.salary
    ? `${job.salary.min ? nf.format(job.salary.min) : ""}${job.salary.max ? ` – ${nf.format(job.salary.max)}` : ""} ${job.salary.currency}${t(`salaryPeriod.${job.salary.period}`)}`
    : null;

  return (
    <li className="card flex flex-col gap-4 p-5 sm:flex-row">
      {showMatch && (
        <div className="flex shrink-0 items-center gap-3 sm:w-24 sm:flex-col sm:items-center">
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${RING[level]} ${match.score * 3.6}deg, var(--surface-2) 0)` }}
            role="img"
            aria-label={`${match.score} % ${t("match")}`}
          >
            <span className="num flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface text-base font-semibold">{match.score}%</span>
          </div>
          <span className="text-xs text-muted">{t("match")}</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-accent">{job.company}</p>
            <h2 className="mt-0.5 text-lg font-semibold leading-snug">{job.title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>{t(`positions.${job.position}`)}</span>
              <span>{t(`segments.${job.segment}`)}</span>
              <span className="num rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-text">{t(`regions.${job.region}`)}{job.authority !== "LOCAL" ? ` · ${job.authority}` : ""}</span>
              {(job.location || job.country) && (
                <span className="flex items-center gap-1"><MapPin size={13} aria-hidden /> {[job.location, job.country].filter(Boolean).join(" · ")}</span>
              )}
              <span>{job.postedAt ? t("posted", { date: fd(job.postedAt) }) : t("postedNone")}</span>
              <span>{t("checked", { date: fd(job.fetchedAt) })}</span>
            </p>
          </div>
          <div className="text-right">
            <p className={`num text-[15px] font-semibold ${salary ? "" : "font-normal text-muted"}`}>{salary ?? t("salaryNone")}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.aircraft.slice(0, 3).map((a) => (
            <span key={a} className="num inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold">
              <Plane size={11} aria-hidden /> {a}
            </span>
          ))}
          {showMatch && match.onType && <Badge level="ok">{t("onType")}</Badge>}
          {showMatch && match.evaluation.criteria.some((c) => c.code === "workRights" && c.verdict === "unmet") && <Badge level="warning">{t("work.noRights", { region: t(`regions.${job.region}`) })}</Badge>}
          {showMatch && match.evaluation.criteria.some((c) => c.code === "licenceAuthority" && c.verdict === "unmet") && <Badge level="caution">{t("work.licenceNeeded", { authority: job.authority })}</Badge>}
          {r.visaSponsored && <Badge level="info">{t("work.visa")}</Badge>}
          {r.typeRatingRequired && <Badge level={showMatch && !match.onType ? "caution" : "neutral"}>{t("tr.required")}</Badge>}
          {r.typeRatingProvided && <Badge level="info">{t("tr.provided")}</Badge>}
          {job.kind === "pool" && <Badge level="neutral">{t("pool")}</Badge>}
        </div>

        {showMatch ? (
          <Criteria evaluation={match.evaluation} />
        ) : (
          reqs.length > 0 && (
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {reqs.map((q) => (
                <li key={q.code} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden />
                  <span className="text-muted">{t(`req.${q.code}`)}</span>
                  <span className="num font-semibold">{q.value}</span>
                </li>
              ))}
            </ul>
          )
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {showMatch ? <p className="text-xs text-muted">{match.confidence < 0.5 ? `${t("lowConfidence")} · ` : ""}{t("crit.scoreNote")}</p> : <span />}
          <span className="flex items-center gap-3">
            {/* Adzuna's API terms: offers it provides are credited, with a link to Adzuna */}
            {job.source === "adzuna" && (
              <a href="https://www.adzuna.com" target="_blank" rel="noopener" className="text-xs text-muted underline">Jobs by Adzuna</a>
            )}
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              {t("apply")} <ExternalLink size={14} aria-hidden />
            </a>
          </span>
        </div>
      </div>
    </li>
  );
}

/** The ad's criteria one by one: met, not met, or to verify (never counted as met), with the gap and the excerpt read. */
function Criteria({ evaluation }: { evaluation: Evaluation }) {
  const t = useTranslations("app.jobs");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB");
  if (!evaluation.criteria.length) return <p className="mt-3 text-sm text-muted">{t("crit.none")}</p>;
  const hoursCode = (c: string) => c.endsWith("Hours");
  const order = { unmet: 0, unknown: 1, met: 2 } as const;
  const list = [...evaluation.criteria].sort((a, b) => order[a.verdict] - order[b.verdict]);
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {t("crit.title")} · <span className="normal-case">{t("crit.summary", { met: evaluation.met, unmet: evaluation.unmet, unknown: evaluation.unknown })}</span>
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {list.map((c, i) => {
          const hours = hoursCode(c.code) && typeof c.required === "number";
          const short = hours && typeof c.have === "number" && c.verdict === "unmet" ? (c.required as number) - c.have : 0;
          return (
            <li key={`${c.code}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {c.verdict === "met" ? (
                <Check size={15} className="shrink-0 self-center text-success" aria-label={t("crit.met")} />
              ) : c.verdict === "unmet" ? (
                <X size={15} className="shrink-0 self-center text-caution" aria-label={t("crit.unmet")} />
              ) : (
                <HelpCircle size={15} className="shrink-0 self-center text-accent" aria-label={t("crit.unknown")} />
              )}
              <span className="text-muted">
                {t(`req.${c.code}`)}
                {c.qualifier ? ` ${t(`crit.q.${c.qualifier}`)}` : ""}
                {!c.mandatory ? ` (${t("crit.preferred")})` : ""}
              </span>
              <span className="num font-semibold">{hours ? `${nf.format(c.required as number)} h` : String(c.required)}</span>
              {c.have !== undefined && c.verdict !== "met" && (
                <span className="num text-xs text-muted">({t("you", { value: hours ? `${nf.format(c.have as number)} h` : String(c.have) })})</span>
              )}
              {short > 0 && <span className="num text-xs font-semibold text-caution">{t("crit.gap", { value: `${nf.format(short)} h` })}</span>}
              {c.reason && <span className="w-full pl-6 text-xs text-muted">{t(`crit.why.${c.reason}`)}</span>}
              {c.evidence && (
                <span className="w-full pl-6 text-xs italic text-muted">
                  {t("crit.source")} : « {c.evidence} »
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
