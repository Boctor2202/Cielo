"use client";

import { Roll } from "@/components/ui/Roll";
import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { countryName, distanceNm, groupTotals, sumFlights } from "@cielo/core";
import { Card, Modal, PageTitle, Readout } from "@/components/app/ui";
import { HoursBars, SplitBar } from "@/components/app/Charts";
import { useAirports } from "@/lib/airports";
import { useDuration, useFlights, usePilot, useTable } from "@/lib/hooks";
import { Achievements } from "@/components/app/Achievements";
import { Flag, LayoverNights } from "@/components/app/LayoverNights";
import { useRouter } from "@/i18n/navigation";
import { Earth } from "lucide-react";

/** Equatorial circumference of the Earth, in nautical miles. */
const EARTH_NM = 21_639;

export default function StatsPage() {
  const t = useTranslations("app.stats");
  const tfn = useTranslations("app.functions");
  const tl = useTranslations("app.logbook");
  const locale = useLocale();
  const flights = useFlights();
  const opening = useTable("opening_balances");
  const airports = useAirports();
  const pilot = usePilot();
  const airportOf = useCallback((icao: string) => airports?.get(icao), [airports]);
  const countryOf = useCallback((icao: string) => airports?.get(icao)?.country, [airports]);
  const d = useDuration();
  const [year, setYear] = useState("");
  const [open, setOpen] = useState<"airports" | "countries" | null>(null);
  const router = useRouter();
  const years = useMemo(() => [...new Set((flights ?? []).map((f) => f.date.slice(0, 4)))].sort().reverse(), [flights]);
  const list = useMemo(() => (flights ?? []).filter((f) => !year || f.date.startsWith(year)), [flights, year]);

  const s = useMemo(() => {
    const tot = sumFlights(list);
    const real = list.filter((f) => !f.isFstd);
    let nm = 0;
    let longest = { nm: 0, label: "—", id: "" };
    const byCountry = new Map<string, { airports: Set<string>; flights: number }>();
    const countries = new Set<string>();
    const visited = new Set<string>();
    for (const f of real) {
      const a = airports?.get(f.depIcao);
      const b = airports?.get(f.arrIcao);
      visited.add(f.depIcao).add(f.arrIcao);
      if (a) countries.add(a.country);
      if (b) countries.add(b.country);
      for (const ap of [a, b]) {
        if (!ap) continue;
        const e = byCountry.get(ap.country) ?? { airports: new Set<string>(), flights: 0 };
        e.airports.add(ap.icao);
        e.flights++;
        byCountry.set(ap.country, e);
      }
      if (a && b) {
        const dist = distanceNm(a, b);
        nm += dist;
        if (dist > longest.nm) longest = { nm: dist, label: `${f.depIcao} → ${f.arrIcao}`, id: f.id };
      }
    }
    return {
      tot,
      nm,
      longest,
      countries: countries.size,
      airports: visited.size,
      allAirports: groupTotals(real, "airport").sort((a, b) => b.flights - a.flights),
      countryList: [...byCountry.entries()].map(([code, e]) => ({ code, airports: [...e.airports].sort(), movements: e.flights })).sort((a, b) => b.movements - a.movements),
      byType: groupTotals(list, "aircraftTypeIcao").slice(0, 10),
      byYear: groupTotals(list, "year").sort((a, b) => a.key.localeCompare(b.key)),
      byFunction: (["PIC", "PICUS", "SIC", "DUAL", "FI", "FE"] as const).map((k) => ({ key: k, minutes: list.filter((f) => f.function === k && !f.isFstd).reduce((x, f) => x + f.totalMin, 0) })).filter((x) => x.minutes > 0),
      topAirports: groupTotals(real, "airport").sort((a, b) => b.flights - a.flights).slice(0, 10),
      regs: groupTotals(real, "registration").slice(0, 8),
    };
  }, [list, airports]);
  const nf = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB");

  return (
    <>
      <PageTitle
        title={t("title")}
        actions={
          <select className="input !w-auto" value={year} onChange={(e) => setYear(e.target.value)} aria-label={tl("allYears")}>
            <option value="">{tl("allYears")}</option>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Readout
          label={t("distance")}
          value={`${nf.format(Math.round(s.nm))} NM`}
          level="info"
          onClick={() => router.push("/app/carte")}
          sub={
            s.nm > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Earth size={14} className="text-sky-500 dark:text-sky-300" aria-hidden />
                {t("earthLaps", { n: new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 1 }).format(s.nm / EARTH_NM) })}
              </span>
            ) : undefined
          }
        />
        <Readout label={t("airportsCount")} value={s.airports} level="neutral" onClick={() => setOpen("airports")} />
        <Readout label={t("countries")} value={s.countries} level="neutral" onClick={() => setOpen("countries")} />
        <Readout
          label={t("longest")}
          value={`${nf.format(Math.round(s.longest.nm))} NM`}
          sub={s.longest.label}
          level="neutral"
          onClick={s.longest.id ? () => router.push({ pathname: "/app/carnet/[id]", params: { id: s.longest.id } }) : undefined}
        />
      </div>
      <Modal open={open === "airports"} onClose={() => setOpen(null)} title={t("airportsCount")}>
        <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto text-sm">
          {s.allAirports.map((a) => (
            <li key={a.key} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                <b className="num">{a.key}</b> <span className="text-muted">{airports?.get(a.key)?.name ?? ""}</span>
              </span>
              <span className="num shrink-0 text-muted">{t("movements", { n: a.flights })}</span>
            </li>
          ))}
        </ul>
      </Modal>
      <Modal open={open === "countries"} onClose={() => setOpen(null)} title={t("countries")}>
        <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto text-sm">
          {s.countryList.map((c) => (
            <li key={c.code} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <Flag code={c.code} />
                <b>{countryName(c.code, locale)}</b>
                <span className="num truncate text-xs text-muted">{c.airports.join(" · ")}</span>
              </span>
              <span className="num shrink-0 text-muted">{t("movements", { n: c.movements })}</span>
            </li>
          ))}
        </ul>
      </Modal>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title={t("conditions")}>
          <div className="space-y-6">
            <SplitBar a={{ label: t("day"), value: s.tot.totalMin - s.tot.nightMin }} b={{ label: t("night"), value: s.tot.nightMin }} format={(m) => d(m)} />
            <SplitBar a={{ label: t("vfr"), value: s.tot.totalMin - s.tot.ifrMin }} b={{ label: t("ifr"), value: s.tot.ifrMin }} format={(m) => d(m)} />
          </div>
        </Card>
        <Card title={t("byYear")}>
          <HoursBars data={s.byYear.map((x) => ({ label: x.key, minutes: x.minutes }))} format={(m) => d(m)} height={180} />
        </Card>
        <Card title={t("byType")}>
          <HoursBars horizontal data={s.byType.map((x) => ({ label: x.key, minutes: x.minutes }))} format={(m) => d(m)} height={160} />
        </Card>
        <Card title={t("byFunction")}>
          <HoursBars horizontal data={s.byFunction.map((x) => ({ label: tfn(x.key).match(/\(([^)]+)\)/)?.[1] ?? x.key, minutes: x.minutes }))} format={(m) => d(m)} height={160} />
        </Card>
        <Card title={t("airports")} pad={false}>
          <ul className="divide-y divide-border text-sm">
            {s.topAirports.map((a, i) => (
              <li key={a.key} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="num w-5 text-xs text-muted">{i + 1}</span>
                  <span className="num font-semibold">{a.key}</span>
                  <span className="min-w-0 truncate text-muted">{airports?.get(a.key)?.name}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-muted">{t("visits", { count: a.flights })}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t("registrations")} pad={false}>
          <ul className="divide-y divide-border text-sm">
            {s.regs.map((r) => (
              <li key={r.key} className="flex items-center justify-between px-5 py-2.5">
                <span className="num font-semibold">{r.key}</span>
                <span className="num"><Roll>{d(r.minutes)}</Roll> <span className="text-muted">· {r.flights}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {flights && (
        <div className="mt-5">
          <LayoverNights flights={flights} homeBase={pilot?.homeBaseIcao} countryOf={countryOf} />
        </div>
      )}
      {/* hours, filters and reports first; the badges come after */}
      {flights && <div className="mt-5"><Achievements flights={flights} opening={opening ?? []} airport={airportOf} pilot={pilot ? { fullName: pilot.fullName, rank: pilot.rank } : undefined} /></div>}
    </>
  );
}