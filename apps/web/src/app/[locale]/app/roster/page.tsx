"use client";

import { Check, ChevronLeft, ChevronRight, Hotel, NotebookPen, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ROSTER_KINDS, analyseTable, mergeRosterImport, printedDutiesToEvents, type PrintedDuty, combineUtc, icalToRosterEvent, isoDate, parseCsv, parseFlexibleDate, parseIcal, stamp, type RosterEvent, type RosterEventKind, rosterLayovers } from "@cielo/core";
import { Link, useRouter } from "@/i18n/navigation";
import { Card, Empty, Field, Modal, PageTitle, Segmented, useToast } from "@/components/app/ui";
import { DropZone } from "@/components/app/DropZone";
import { CalendarFeeds } from "@/components/app/CalendarFeeds";
import { useAirports } from "@/lib/airports";
import { useFlights, useFormatDate, usePilot, useTable } from "@/lib/hooks";
import { put, saveLayover, saveRosterEvent, softDelete } from "@/lib/repo";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

const KINDS = ROSTER_KINDS;
const KIND_STYLE: Record<RosterEventKind, string> = {
  FLIGHT: "bg-accent/15 text-accent border-accent/30",
  DEADHEAD: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  SIM: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  STANDBY: "bg-caution/12 text-caution border-caution/30",
  GROUND: "bg-surface-2 text-text border-border",
  OFF: "bg-success/10 text-success border-success/25",
  LEAVE: "bg-success/10 text-success border-success/25",
  REST: "bg-surface-2 text-muted border-border",
  OTHER: "bg-surface-2 text-muted border-border",
};

export default function RosterPage() {
  const t = useTranslations("app.roster");
  const tc = useTranslations("common");
  const ti = useTranslations("app.import");
  const router = useRouter();
  const locale = useLocale();
  const events = useTable("roster_events");
  const flights = useFlights();
  const layovers = useTable("layovers");
  const pilot = usePilot();
  const airports = useAirports();
  const fd = useFormatDate();
  const { toast, toastNode } = useToast();
  const [view, setView] = useState<"month" | "list">("month");
  const [cursor, setCursor] = useState(() => isoDate(new Date()).slice(0, 7));
  const [importOpen, setImportOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<RosterEvent> | null>(null);
  const [selected, setSelected] = useState<RosterEvent | null>(null);
  // a day with more duties than its cell shows: all of them in a list
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const today = isoDate(new Date());

  const sorted = useMemo(() => [...(events ?? [])].sort((a, b) => a.startUtc.localeCompare(b.startUtc)), [events]);
  const days = useMemo(() => {
    const [y, m] = cursor.split("-").map(Number) as [number, number];
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7; // Monday first
    const start = Date.UTC(y, m - 1, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => isoDate(start + i * 86_400_000));
  }, [cursor]);
  const byDay = useMemo(() => {
    const map = new Map<string, RosterEvent[]>();
    for (const e of sorted) {
      const k = e.startUtc.slice(0, 10);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [sorted]);

  const shift = (n: number) => {
    const [y, m] = cursor.split("-").map(Number) as [number, number];
    setCursor(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));
  };
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${cursor}-01T12:00:00Z`));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 5 + i))));

  const [reading, setReading] = useState(false);

  /** A PDF roster (Leon read directly, other layouts by the server's reader): duties → events in UTC. */
  async function onPdf(file: File) {
    if (!pilot) return;
    if (file.size > 3_000_000) return toast(t("pdf.err.too_big"));
    const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
    if (!token) return toast(t("pdf.err.signin"));
    setReading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const r = await fetch("/api/roster-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdf: btoa(bin), fileName: file.name, today: new Date().toISOString().slice(0, 10) }),
      });
      const d = (await r.json().catch(() => ({}))) as { timeBasis?: "UTC" | "local"; events?: PrintedDuty[]; error?: string };
      if (!r.ok || !d.events) {
        const code = ["signin", "plan", "unsupported", "not_configured", "too_big", "rate_limited"].includes(d.error ?? "") ? d.error! : "upstream";
        return toast(t(`pdf.err.${code}` as "pdf.err.upstream"));
      }
      const roster = await put("rosters", { source: "manual", fileName: file.name, importedAt: new Date().toISOString() });
      const home = pilot.homeBaseIcao ? airports?.get(pilot.homeBaseIcao)?.timezone : undefined;
      const incoming = printedDutiesToEvents(d.events, d.timeBasis ?? "local", {
        pilotId: pilot.id,
        rosterId: roster.id,
        toIcao: (c) => (c.length === 3 ? airports?.iataToIcao(c) ?? c : airports?.get(c)?.icao ?? c),
        timezoneOf: (icao) => airports?.get(icao)?.timezone,
        homeTimezone: home,
      });
      // the new print replaces the days it covers: same duties updated in place (logged flights stay linked)
      const m = mergeRosterImport(events ?? [], incoming, flights ?? []);
      await db().t("roster_events").bulkPut(m.put);
      setImportOpen(false);
      toast(m.added + m.updated + m.removed + m.linked ? t("pdf.merged", { added: m.added, updated: m.updated, removed: m.removed, linked: m.linked }) : t("pdf.nothingNew"));
      const first = [...incoming].sort((a, b) => a.startUtc.localeCompare(b.startUtc))[0];
      if (first) setCursor(first.startUtc.slice(0, 7));
    } catch {
      toast(t("pdf.err.upstream"));
    } finally {
      setReading(false);
    }
  }

  async function onFile(file: File) {
    if (!pilot) return;
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return onPdf(file);
    const text = await file.text();
    const roster = await put("rosters", { source: /\.ics$/i.test(file.name) || text.includes("BEGIN:VCALENDAR") ? "ical" : "csv", fileName: file.name, importedAt: new Date().toISOString() });
    let rows: RosterEvent[] = [];
    if (roster.source === "ical") {
      const existing = new Map((events ?? []).filter((e) => e.externalUid).map((e) => [e.externalUid!, e]));
      rows = parseIcal(text).map((ev) => {
        const r = icalToRosterEvent(ev, pilot.id, (iata) => airports?.iataToIcao(iata));
        const prev = r.externalUid ? existing.get(r.externalUid) : undefined;
        return stamp({ ...prev, ...r, id: prev?.id, rosterId: roster.id, flightId: prev?.flightId ?? null } as RosterEvent);
      });
    } else {
      // header row (title lines above it skipped), columns from names and values, and the date order (31/12 vs 12/31)
      const a = analyseTable(parseCsv(text.replace(/^\uFEFF/, "")));
      const map = a.mapping;
      for (const r of a.rows) {
        const g = (k: keyof typeof map) => (map[k] >= 0 ? (r[map[k]] ?? "").trim() : "");
        const date = parseFlexibleDate(g("date"), a.dateOrder);
        if (!date) continue;
        const start = combineUtc(date, g("out") || "00:00");
        const end = combineUtc(date, g("in") || "23:59", start);
        if (!start || !end) continue;
        const dep = g("dep").toUpperCase();
        const arr = g("arr").toUpperCase();
        rows.push(stamp({ pilotId: pilot.id, rosterId: roster.id, kind: dep && arr ? "FLIGHT" : "OTHER", title: [g("flightNumber"), dep && arr ? `${dep}-${arr}` : g("remarks")].filter(Boolean).join(" "), startUtc: start, endUtc: end, flightNumber: g("flightNumber") || undefined, depIcao: airports?.get(dep)?.icao ?? (dep || undefined), arrIcao: airports?.get(arr)?.icao ?? (arr || undefined), aircraftReg: g("registration") || undefined, aircraftTypeIcao: g("type") || undefined } as RosterEvent));
      }
    }
    await db().t("roster_events").bulkPut(rows);
    setImportOpen(false);
    toast(t("imported", { count: rows.length }));
    if (rows[0]) setCursor(rows[0].startUtc.slice(0, 7));
  }

  async function openLayover(e: RosterEvent) {
    const existing = layovers?.find((l) => l.rosterEventId === e.id);
    // the departure: the next duty leaving that airport, when the roster has it
    const stay = rosterLayovers(events ?? [], pilot?.homeBaseIcao).find((r) => r.rosterEventId === e.id);
    const l = existing ?? (await saveLayover({ airportIcao: e.arrIcao ?? "", rosterEventId: e.id, arrivalUtc: e.endUtc, departureUtc: stay?.departureUtc ?? null, contacts: [] }));
    router.push({ pathname: "/app/escales/[id]", params: { id: l.id } });
  }

  const EventChip = ({ e }: { e: RosterEvent }) => (
    <button type="button" onClick={() => setSelected(e)} className={`num w-full truncate rounded border px-1 py-0.5 text-left text-[10.5px] font-semibold leading-tight sm:text-[11px] ${KIND_STYLE[e.kind]} ${e.tentative ? "border-dashed opacity-60" : ""}`} title={e.tentative ? t("option") : undefined}>
      {e.tentative && <span className="mr-0.5 font-bold">?</span>}
      {e.kind === "FLIGHT" || e.kind === "DEADHEAD" ? `${e.depIcao ?? ""}-${e.arrIcao ?? ""}` : t(`kinds.${e.kind}`)}
      {e.flightId && " ✓"}
    </button>
  );

  return (
    <>
      <PageTitle
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImportOpen(true)}><Upload size={15} /> {t("import")}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit({ kind: "FLIGHT", startUtc: `${today}T08:00:00.000Z`, endUtc: `${today}T10:00:00.000Z` })}><Plus size={15} /> {t("addEvent")}</button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm !px-2" onClick={() => shift(-1)} aria-label="previous"><ChevronLeft size={16} /></button>
          <h2 className="min-w-36 text-center text-lg font-semibold capitalize">{monthLabel}</h2>
          <button type="button" className="btn btn-secondary btn-sm !px-2" onClick={() => shift(1)} aria-label="next"><ChevronRight size={16} /></button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCursor(today.slice(0, 7))}>{t("today")}</button>
        </div>
        <Segmented value={view} onChange={setView} options={[{ value: "month", label: t("month") }, { value: "list", label: t("list") }]} />
      </div>

      {view === "month" ? (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface-2/50">
            {weekdays.map((w) => <div key={w} className="label-caps px-2 py-2 text-center">{w}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const evs = byDay.get(day) ?? [];
              const inMonth = day.startsWith(cursor);
              return (
                <div key={day} className={`min-h-[76px] border-b border-r border-border p-1 sm:min-h-[96px] sm:p-1.5 ${inMonth ? "" : "bg-surface-2/40 opacity-60"}`}>
                  <p className={`num mb-1 text-xs ${day === today ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent font-bold text-accent-contrast" : "text-muted"}`}>{+day.slice(8)}</p>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((e) => <EventChip key={e.id} e={e} />)}
                    {evs.length > 3 && (
                      <button type="button" onClick={() => setDayOpen(day)} className="w-full rounded px-1 text-left text-[10.5px] font-semibold text-accent hover:bg-surface-2">
                        +{evs.length - 3}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card pad={false}>
          {sorted.filter((e) => e.startUtc.startsWith(cursor)).length === 0 ? (
            <Empty text={t("empty")} />
          ) : (
            <ul className="divide-y divide-border">
              {sorted.filter((e) => e.startUtc.startsWith(cursor)).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[e.kind]} ${e.tentative ? "border-dashed opacity-70" : ""}`}>{e.tentative ? t("option") : t(`kinds.${e.kind}`)}</span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(e)}>
                    <p className="num truncate text-sm font-semibold">{e.title || `${e.depIcao ?? ""} → ${e.arrIcao ?? ""}`}</p>
                    <p className="num text-xs text-muted">{fd(e.startUtc, { weekday: "short", day: "2-digit", month: "short" })} · {e.startUtc.slice(11, 16)}–{e.endUtc.slice(11, 16)} UTC</p>
                  </button>
                  {e.flightId && <span className="text-xs font-semibold text-success">{t("logged")}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={!!dayOpen} onClose={() => setDayOpen(null)} title={dayOpen ? fd(`${dayOpen}T12:00:00Z`, { dateStyle: "full" }) : ""}>
        <ul className="space-y-1.5">
          {(dayOpen ? byDay.get(dayOpen) ?? [] : []).map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => (setDayOpen(null), setSelected(e))} className={`num flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold ${KIND_STYLE[e.kind]} ${e.tentative ? "border-dashed opacity-70" : ""}`}>
                <span className="flex-1 truncate">{e.kind === "FLIGHT" || e.kind === "DEADHEAD" ? `${e.depIcao ?? ""} → ${e.arrIcao ?? ""}` : t(`kinds.${e.kind}`)}{e.flightId && " ✓"}</span>
                <span className="text-xs font-normal">{e.startUtc.slice(11, 16)}–{e.endUtc.slice(11, 16)} UTC</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${t(`kinds.${selected.kind}`)}${selected.tentative ? ` · ${t("option")}` : ""}` : ""}>
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="num text-lg font-semibold">{selected.title}</p>
              <p className="num text-sm text-muted">{fd(selected.startUtc, { dateStyle: "full" })}</p>
              {selected.tentative && <p className="mt-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-400/10 px-3 py-2 text-xs">{t("optionHint")}</p>}
              <p className="num mt-1 text-sm">{selected.reportUtc && `${t("report")} ${selected.reportUtc.slice(11, 16)} · `}{selected.startUtc.slice(11, 16)} – {selected.endUtc.slice(11, 16)} UTC</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(selected.kind === "FLIGHT" || selected.kind === "SIM") && !selected.flightId && (
                <Link href={{ pathname: "/app/carnet/nouveau", query: { roster: selected.id } }} className="btn btn-primary btn-sm"><NotebookPen size={15} /> {t("logFlight")}</Link>
              )}
              {selected.flightId && <Link href={{ pathname: "/app/carnet/[id]", params: { id: selected.flightId } }} className="btn btn-secondary btn-sm">✓ {t("logged")}</Link>}
              {selected.tentative && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={async () => (await db().t("roster_events").put(stamp({ ...selected, tentative: false })), setSelected(null))}>
                  <Check size={15} /> {t("confirmOption")}
                </button>
              )}
              {selected.arrIcao && <button type="button" className="btn btn-secondary btn-sm" onClick={() => openLayover(selected)}><Hotel size={15} /> {t("layover")}</button>}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => (setEdit(selected), setSelected(null))}>{tc("edit")}</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={async () => (await softDelete("roster_events", selected.id), setSelected(null))}><Trash2 size={14} /> {t("deleteEvent")}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t("import")}>
        <p className="mb-4 text-sm text-muted">{t("importHelp")}</p>
        <DropZone accept=".ics,.csv,.txt,.pdf" onFile={(f) => void onFile(f)} label={ti("drop")} />
        {reading ? <p className="mt-3 text-sm text-muted">{t("pdf.reading")}</p> : null}
        <div className="mt-6 border-t border-border pt-5">
          <CalendarFeeds onSynced={(msg) => toast(msg)} />
        </div>
      </Modal>

      <EventEditor draft={edit} onClose={() => setEdit(null)} />
      {toastNode}
    </>
  );
}

function EventEditor({ draft, onClose }: { draft: Partial<RosterEvent> | null; onClose: () => void }) {
  const t = useTranslations("app.roster");
  const tc = useTranslations("common");
  const [v, setV] = useState<Partial<RosterEvent>>({});
  const [lastDraft, setLastDraft] = useState<typeof draft>(null);
  if (draft !== lastDraft) {
    setLastDraft(draft);
    setV(draft ?? {});
  }
  const dt = (iso?: string | null) => (iso ? iso.slice(0, 16) : "");
  const toIso = (s: string) => (s ? new Date(`${s}:00Z`).toISOString() : null);
  return (
    <Modal open={!!draft} onClose={onClose} title={t("addEvent")}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await saveRosterEvent({ ...(v as RosterEvent), kind: v.kind ?? "OTHER", startUtc: v.startUtc!, endUtc: v.endUtc! });
          onClose();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("kind")}>
            <select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as RosterEventKind })}>
              {KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
            </select>
          </Field>
          <Field label={t("title2")}><input className="input" value={v.title ?? ""} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
          <Field label={t("start")}><input type="datetime-local" className="input num" required value={dt(v.startUtc)} onChange={(e) => setV({ ...v, startUtc: toIso(e.target.value)! })} /></Field>
          <Field label={t("end")}><input type="datetime-local" className="input num" required value={dt(v.endUtc)} onChange={(e) => setV({ ...v, endUtc: toIso(e.target.value)! })} /></Field>
          <Field label={t("report")}><input type="datetime-local" className="input num" value={dt(v.reportUtc)} onChange={(e) => setV({ ...v, reportUtc: toIso(e.target.value) })} /></Field>
          <Field label="N°"><input className="input num uppercase" value={v.flightNumber ?? ""} onChange={(e) => setV({ ...v, flightNumber: e.target.value.toUpperCase() })} /></Field>
          <Field label="DEP"><input className="input num uppercase" value={v.depIcao ?? ""} onChange={(e) => setV({ ...v, depIcao: e.target.value.toUpperCase() })} /></Field>
          <Field label="ARR"><input className="input num uppercase" value={v.arrIcao ?? ""} onChange={(e) => setV({ ...v, arrIcao: e.target.value.toUpperCase() })} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{tc("cancel")}</button>
          <button className="btn btn-primary">{tc("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
