"use client";

import { Sun, BedDouble, CalendarDays, ChevronRight, Globe2, Hotel, MapPin, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { countryName, rosterLayovers, unsavedRosterLayovers } from "@cielo/core";
import { Flag } from "@/components/app/LayoverNights";
import { Roll } from "@/components/ui/Roll";
import { AirportInput } from "@/components/app/AirportInput";
import { Card, Empty, Field, Modal, PageTitle } from "@/components/app/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useAirports } from "@/lib/airports";
import { useFormatDate, usePilot, useTable, useToday } from "@/lib/hooks";
import { saveLayover } from "@/lib/repo";

/**
 * Layovers on their own: a pilot creates one with just the airport and dates, with or without a roster.
 * (Pilots who import their roster can still open a layover from a flight in the roster.)
 */
export default function LayoversPage() {
  const t = useTranslations("app.layovers");
  const layovers = useTable("layovers");
  const events = useTable("roster_events");
  const pilot = usePilot();
  const airports = useAirports();
  const today = useToday();
  const fd = useFormatDate();
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [airport, setAirport] = useState("");
  const [arrival, setArrival] = useState(today);
  const [departure, setDeparture] = useState("");

  const { upcoming, past } = useMemo(() => {
    // the roster's layovers not saved yet are listed too: opening one saves it, the pilot adds the hotel
    const fromRoster = unsavedRosterLayovers(events ?? [], layovers ?? [], pilot?.homeBaseIcao).map(
      (r) => ({ id: `roster:${r.rosterEventId}`, pilotId: pilot?.id ?? "", airportIcao: r.airportIcao, arrivalUtc: r.arrivalUtc, departureUtc: r.departureUtc, rosterEventId: r.rosterEventId, contacts: [], createdAt: r.arrivalUtc, updatedAt: r.arrivalUtc }) as unknown as NonNullable<typeof layovers>[number],
    );
    // a layover saved from the roster without its departure: the roster has it
    const stays = new Map(rosterLayovers(events ?? [], pilot?.homeBaseIcao).map((r) => [r.rosterEventId, r]));
    const saved = (layovers ?? []).filter((l) => !l.deletedAt).map((l) => (!l.departureUtc && l.rosterEventId && stays.get(l.rosterEventId) ? { ...l, departureUtc: stays.get(l.rosterEventId)!.departureUtc } : l));
    const live = [...saved, ...fromRoster];
    const day = (l: (typeof live)[number]) => (l.departureUtc ?? l.arrivalUtc ?? l.createdAt).slice(0, 10);
    const up = live.filter((l) => day(l) >= today).sort((a, b) => (a.arrivalUtc ?? "").localeCompare(b.arrivalUtc ?? ""));
    const old = live.filter((l) => day(l) < today).sort((a, b) => (b.arrivalUtc ?? "").localeCompare(a.arrivalUtc ?? ""));
    return { upcoming: up, past: old };
  }, [layovers, events, pilot?.homeBaseIcao, pilot?.id, today]);

  type L = NonNullable<typeof layovers>[number];
  const nightsOf = (l: L) => (l.arrivalUtc && l.departureUtc ? Math.max(0, Math.round((Date.parse(l.departureUtc.slice(0, 10)) - Date.parse(l.arrivalUtc.slice(0, 10))) / 86_400_000)) : 0);
  const stats = useMemo(() => {
    const all = [...upcoming, ...past];
    return {
      count: all.length,
      nights: all.reduce((s, l) => s + nightsOf(l), 0),
      countries: new Set(all.map((l) => airports?.get(l.airportIcao)?.country).filter(Boolean)).size,
      cities: new Set(all.map((l) => l.airportIcao)).size,
    };
  }, [upcoming, past, airports]);
  // "now", "tomorrow", "in 5 days"
  const when = (l: L) => {
    const a = (l.arrivalUtc ?? "").slice(0, 10);
    if (!a || a <= today) return { text: t("now"), live: true };
    const d = Math.round((Date.parse(a) - Date.parse(today)) / 86_400_000);
    return { text: d === 1 ? t("tomorrow") : t("inDays", { n: d }), live: false };
  };
  const day = (iso?: string | null) => (iso ? { d: iso.slice(8, 10), m: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(iso)).replace(".", "") } : null);

  const Upcoming = ({ l }: { l: L }) => {
    const ap = airports?.get(l.airportIcao);
    const cc = ap?.country;
    const w = when(l);
    const n = nightsOf(l);
    const a = day(l.arrivalUtc);
    // arriving and leaving the same day (a day stop): the hours there instead of "0 nights"
    const sameDay = !!l.departureUtc && l.departureUtc.slice(0, 10) === l.arrivalUtc?.slice(0, 10);
    const hours = sameDay ? Math.round((Date.parse(l.departureUtc!) - Date.parse(l.arrivalUtc!)) / 3_600_000) : 0;
    const b = sameDay ? null : day(l.departureUtc);
    return (
      <Link
        href={{ pathname: "/app/escales/[id]", params: { id: l.id } }}
        onClick={(ev) => openRoster(ev, l)}
        className="group relative block overflow-hidden rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_12px_40px_-12px_rgba(34,197,94,0.35)]"
      >
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl transition group-hover:bg-accent/25" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {cc ? <span className="scale-150 pl-1">{<Flag code={cc} />}</span> : <MapPin size={20} className="text-muted" />}
            <div className="min-w-0 pl-1">
              <div className="truncate text-xl font-bold">{ap?.city || ap?.name || l.airportIcao}</div>
              <div className="truncate text-sm text-muted">
                <span className="num font-semibold text-fg/80">{l.airportIcao}</span>
                {cc ? ` · ${countryName(cc, locale) ?? cc}` : ""}
              </div>
              {l.rosterEventId ? (
                <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-sky-400">
                  <CalendarDays size={12} /> {t("fromRoster")}
                </div>
              ) : null}
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${w.live ? "bg-accent text-black" : "bg-accent/15 text-accent"}`}>
            {w.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" />}
            {w.text}
          </span>
        </div>

        <div className="relative mt-5 flex items-center gap-3">
          {a && (
            <div className="w-14 overflow-hidden rounded-xl border border-border text-center">
              <div className="bg-accent/80 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">{a.m}</div>
              <div className="num py-1 text-xl font-bold">{a.d}</div>
            </div>
          )}
          {b || hours > 0 ? <div className="flex flex-1 items-center gap-2">
            <span className="h-px flex-1 border-t border-dashed border-muted/60" />
            {b || hours > 0 ? (
              <>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${b ? "bg-indigo-400/15 text-indigo-300" : "bg-amber-400/15 text-amber-300"}`}>
                  {b ? <><BedDouble size={13} /> {t("nights", { n })}</> : <><Sun size={13} /> {t("dayStop", { h: hours })}</>}
                </span>
                <span className="h-px flex-1 border-t border-dashed border-muted/60" />
              </>
            ) : null}
          </div> : null}
          {b && (
            <div className="w-14 overflow-hidden rounded-xl border border-border text-center">
              <div className="bg-sky-400/80 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">{b.m}</div>
              <div className="num py-1 text-xl font-bold">{b.d}</div>
            </div>
          )}
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 ${l.hotelName ? "bg-surface-2" : "bg-amber-400/15 text-amber-300"}`}>
            <Hotel size={14} className="shrink-0" /> <span className="truncate">{l.hotelName || t("noHotel")}</span>
          </span>
          {l.contacts?.length ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1">
              <Users size={14} /> {l.contacts.length}
            </span>
          ) : null}
          <ChevronRight size={18} className="ml-auto text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
      </Link>
    );
  };

  // a layover from the roster is saved when the pilot opens it
  const openRoster = async (ev: React.MouseEvent, l: L) => {
    if (!l.id.startsWith("roster:")) return;
    ev.preventDefault();
    const saved = await saveLayover({ airportIcao: l.airportIcao, rosterEventId: l.rosterEventId, arrivalUtc: l.arrivalUtc, departureUtc: l.departureUtc, contacts: [] });
    router.push({ pathname: "/app/escales/[id]", params: { id: saved.id } });
  };

  const create = async () => {
    if (!airports?.get(airport)) return;
    const l = await saveLayover({
      airportIcao: airport,
      arrivalUtc: arrival ? `${arrival}T12:00:00.000Z` : null,
      departureUtc: departure ? `${departure}T12:00:00.000Z` : null,
      contacts: [],
    });
    setOpen(false);
    router.push({ pathname: "/app/escales/[id]", params: { id: l.id } });
  };

  const Row = ({ l }: { l: NonNullable<typeof layovers>[number] }) => {
    const ap = airports?.get(l.airportIcao);
    const dates = [fd(l.arrivalUtc), fd(l.departureUtc)].filter(Boolean).join(" → ");
    return (
      <li>
        <Link href={{ pathname: "/app/escales/[id]", params: { id: l.id } }} onClick={(ev) => openRoster(ev, l)} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2">
          {ap?.country ? <Flag code={ap.country} /> : <MapPin size={18} className="shrink-0 text-muted" />}
          <span className="num w-14 shrink-0 text-lg font-semibold">{l.airportIcao}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{ap?.city || ap?.name || l.airportIcao}</span>
            <span className="flex items-center gap-1.5 truncate text-sm text-muted">
              {l.hotelName ? (
                <>
                  <Hotel size={13} className="shrink-0" /> {l.hotelName}
                </>
              ) : (
                t("noHotel")
              )}
            </span>
          </span>
          {nightsOf(l) > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-400/15 px-2 py-0.5 text-xs font-semibold text-indigo-300">
              <BedDouble size={12} /> {nightsOf(l)}
            </span>
          )}
          <span className="hidden shrink-0 text-sm text-muted sm:block">{dates}</span>
          <ChevronRight size={18} className="shrink-0 text-muted" />
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageTitle
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> {t("new")}
          </button>
        }
      />
      {layovers && upcoming.length + past.length === 0 ? (
        <Card>
          <Empty icon={<Hotel size={36} />} text={t("empty")} action={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> {t("new")}</button>} />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: CalendarDays, color: "text-accent bg-accent/15", label: t("statLayovers"), v: stats.count },
              { icon: BedDouble, color: "text-indigo-300 bg-indigo-400/15", label: t("statNights"), v: stats.nights },
              { icon: MapPin, color: "text-sky-300 bg-sky-400/15", label: t("statCities"), v: stats.cities },
              { icon: Globe2, color: "text-amber-300 bg-amber-400/15", label: t("statCountries"), v: stats.countries },
            ].map(({ icon: Icon, color, label, v }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}><Icon size={19} /></span>
                <div className="min-w-0">
                  <div className="num text-2xl font-bold leading-none"><Roll>{String(v)}</Roll></div>
                  <div className="mt-1 truncate text-xs text-muted">{label}</div>
                </div>
              </div>
            ))}
          </div>
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t("upcoming")} <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">{upcoming.length}</span></h2>
              <div className="grid gap-4 md:grid-cols-2">{upcoming.map((l) => <Upcoming key={l.id} l={l} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <Card title={t("past")} pad={false}>
              <ul className="divide-y divide-border">{past.map((l) => <Row key={l.id} l={l} />)}</ul>
            </Card>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("new")}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <AirportInput label={t("airport")} value={airport} onChange={setAirport} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("arrival")}><input id="lay-arr" className="input num" type="date" value={arrival} onChange={(e) => setArrival(e.target.value)} /></Field>
            <Field label={t("departure")}><input id="lay-dep" className="input num" type="date" value={departure} min={arrival} onChange={(e) => setDeparture(e.target.value)} /></Field>
          </div>
          <button className="btn btn-primary w-full" disabled={!airports?.get(airport)}>{t("create")}</button>
        </form>
      </Modal>
    </>
  );
}
