"use client";

import { ChevronRight, Hotel, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AirportInput } from "@/components/app/AirportInput";
import { Card, Empty, Field, Modal, PageTitle } from "@/components/app/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useAirports } from "@/lib/airports";
import { useFormatDate, useTable, useToday } from "@/lib/hooks";
import { saveLayover } from "@/lib/repo";

/**
 * Layovers on their own: a pilot creates one with just the airport and dates, with or without a roster.
 * (Pilots who import their roster can still open a layover from a flight in the roster.)
 */
export default function LayoversPage() {
  const t = useTranslations("app.layovers");
  const layovers = useTable("layovers");
  const airports = useAirports();
  const today = useToday();
  const fd = useFormatDate();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [airport, setAirport] = useState("");
  const [arrival, setArrival] = useState(today);
  const [departure, setDeparture] = useState("");

  const { upcoming, past } = useMemo(() => {
    const live = (layovers ?? []).filter((l) => !l.deletedAt);
    const day = (l: (typeof live)[number]) => (l.departureUtc ?? l.arrivalUtc ?? l.createdAt).slice(0, 10);
    const up = live.filter((l) => day(l) >= today).sort((a, b) => (a.arrivalUtc ?? "").localeCompare(b.arrivalUtc ?? ""));
    const old = live.filter((l) => day(l) < today).sort((a, b) => (b.arrivalUtc ?? "").localeCompare(a.arrivalUtc ?? ""));
    return { upcoming: up, past: old };
  }, [layovers, today]);

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
        <Link href={{ pathname: "/app/escales/[id]", params: { id: l.id } }} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2">
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
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <Card title={t("upcoming")} pad={false}>
              <ul className="divide-y divide-border">{upcoming.map((l) => <Row key={l.id} l={l} />)}</ul>
            </Card>
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
