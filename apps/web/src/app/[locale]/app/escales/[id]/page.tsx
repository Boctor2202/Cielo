"use client";

import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import type { Layover } from "@cielo/core";
import { Link, useRouter } from "@/i18n/navigation";
import { Card, Field, PageTitle, useToast } from "@/components/app/ui";
import { useAirports } from "@/lib/airports";
import { useFormatDate, useTable } from "@/lib/hooks";
import { saveLayover, softDelete } from "@/lib/repo";
import { db } from "@/lib/db";
import { Activities } from "./Activities";

export default function LayoverPage() {
  const t = useTranslations("app.layover");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const airports = useAirports();
  const fd = useFormatDate();
  const all = useTable("layovers");
  const layover = useLiveQuery(() => db().t("layovers").get(id), [id]);
  const [v, setV] = useState<Layover | null>(null);
  const { toast, toastNode } = useToast();
  useEffect(() => {
    if (layover && !v) setV(layover);
  }, [layover, v]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!v) return <p className="text-muted">…</p>;
  const ap = airports?.get(v.airportIcao);
  const others = (all ?? []).filter((l) => l.airportIcao === v.airportIcao && l.id !== v.id);

  return (
    <>
      <Link href="/app/escales" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
        <ArrowLeft size={15} /> {t("back")}
      </Link>
      <PageTitle
        title={t("title", { icao: v.airportIcao })}
        subtitle={ap ? `${ap.name}${ap.city ? ` · ${ap.city}` : ""}` : undefined}
        actions={
          ap?.timezone && (
            <div className="card px-4 py-2 text-right">
              <p className="label-caps">{t("localTime")}</p>
              <p className="num text-xl font-semibold">{new Intl.DateTimeFormat(locale, { timeZone: ap.timezone, hour: "2-digit", minute: "2-digit" }).format(now)}</p>
              <p className="text-xs text-muted">{ap.timezone}</p>
            </div>
          )
        }
      />
      <form
        className="grid gap-5 lg:grid-cols-[1fr_320px]"
        onSubmit={async (e) => {
          e.preventDefault();
          await saveLayover(v);
          toast(tc("saved"));
        }}
      >
        <div className="space-y-5">
          <Card title={t("hotel")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("hotel")}><input className="input" value={v.hotelName ?? ""} onChange={(e) => setV({ ...v, hotelName: e.target.value })} /></Field>
              <Field label={t("phone")}><input className="input num" type="tel" value={v.phone ?? ""} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
              <Field label={t("arrival")}><input className="input num" type="date" value={v.arrivalUtc?.slice(0, 10) ?? ""} onChange={(e) => setV({ ...v, arrivalUtc: e.target.value ? `${e.target.value}T12:00:00.000Z` : null })} /></Field>
              <Field label={t("departure")}><input className="input num" type="date" value={v.departureUtc?.slice(0, 10) ?? ""} onChange={(e) => setV({ ...v, departureUtc: e.target.value ? `${e.target.value}T12:00:00.000Z` : null })} /></Field>
              <Field label={t("address")} className="sm:col-span-2"><input className="input" value={v.address ?? ""} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
              <Field label={t("notes")} className="sm:col-span-2"><textarea className="input" rows={4} value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title={t("contacts")}>
            <div className="space-y-2">
              {v.contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <input className="input" placeholder={t("contactName")} value={c.name} onChange={(e) => setV({ ...v, contacts: v.contacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <input className="input" placeholder={t("contactRole")} value={c.role ?? ""} onChange={(e) => setV({ ...v, contacts: v.contacts.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} />
                  <input className="input num" placeholder={t("phone")} value={c.phone ?? ""} onChange={(e) => setV({ ...v, contacts: v.contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) })} />
                  <button type="button" className="btn btn-ghost !px-2" aria-label={tc("delete")} onClick={() => setV({ ...v, contacts: v.contacts.filter((_, j) => j !== i) })}><X size={16} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setV({ ...v, contacts: [...v.contacts, { name: "" }] })}><Plus size={14} /> {t("addContact")}</button>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <div className="card space-y-2 p-4">
            <button className="btn btn-primary w-full">{tc("save")}</button>
            <button type="button" className="btn btn-danger btn-sm w-full" onClick={async () => (await softDelete("layovers", v.id), router.push("/app/escales"))}><Trash2 size={14} /> {tc("delete")}</button>
          </div>
          {others.length > 0 && (
            <Card title={t("history", { icao: v.airportIcao })} pad={false}>
              <ul className="divide-y divide-border text-sm">
                {others.map((o) => (
                  <li key={o.id} className="px-5 py-3">
                    <p className="font-medium">{o.hotelName || "—"}</p>
                    <p className="text-xs text-muted">{fd(o.arrivalUtc)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </form>
      <div className="mt-5">
        <Activities
          hotelPlaceId={v.hotelPlaceId}
          airport={ap ? { lat: ap.lat, lon: ap.lon, name: ap.name } : undefined}
          onHotel={async (h) => {
            const next = { ...v, hotelPlaceId: h.id, hotelName: h.name, address: h.address ?? v.address };
            setV(next);
            await saveLayover(next);
            toast(t("activities.hotelSaved"));
          }}
        />
      </div>
      {toastNode}
    </>
  );
}
