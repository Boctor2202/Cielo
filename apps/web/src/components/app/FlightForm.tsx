"use client";

import { Roll } from "@/components/ui/Roll";
import { Clock, CloudSun, Copy, CornerUpLeft, Lock, MonitorPlay, NotebookPen, PenLine, Plane, PlaneLanding, Plus, Radar, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  defaultIfrFor, deriveFlightTimes, isoDate, PILOT_FUNCTIONS, type Aircraft, type Approach, type Flight, type FlightFormInput, type Pilot,
  APPROACH_TYPES, EXTRA_FLIGHT_FIELDS, distanceNm, operatorIndex, isPilot, extraFieldsFor, frameworkOf, LOGGED_SHARES, shareLabel,
} from "@cielo/core";
import { useRouter } from "@/i18n/navigation";
import { useAirports } from "@/lib/airports";
import { useDuration, useFlights, useTable, useTypes } from "@/lib/hooks";
import { announceGains } from "@/lib/gains";
import { useAirlineDirectory } from "@/lib/airlines";
import { OperatorInput } from "./OperatorInput";
import { findType, flightToInput, saveFlight, softDelete } from "@/lib/repo";
import { db } from "@/lib/db";
import { useAccess } from "@/lib/access";
import { AircraftPhoto } from "./AircraftPhoto";
import { AirportInput } from "./AirportInput";
import { FlightAwareFill } from "./FlightAwareFill";
import { ReportPaste } from "./ReportPaste";
import { Card, ClockInput, DurationInput, Field, Meter, Segmented, Toggle, useToast } from "./ui";
import { SignatureModal, SignatureStatus, SignWithSavedButton } from "./Signature";
import { FlightHistory } from "./FlightHistory";


/** A registration or callsign without dashes or spaces, for comparing them. */
const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();

function blank(pilot: Pilot | undefined): FlightFormInput {
  return {
    date: isoDate(new Date()),
    depIcao: pilot?.homeBaseIcao ?? "",
    arrIcao: "",
    function: pilot?.defaultFunction ?? "PIC",
    ifr: pilot?.defaultIfr === "always",
    pilotFlying: pilot?.defaultPilotFlying !== "never",
    autoLandings: true,
    isFstd: false,
    approaches: [],
    crew: [],
  };
}

export function FlightForm({ flight, prefill, pilot, source, rosterEventId }: { flight?: Flight; prefill?: Partial<FlightFormInput>; pilot?: Pilot; source?: Flight["source"]; rosterEventId?: string }) {
  const t = useTranslations("app.form");
  const tacc = useTranslations("app.access");
  const tc = useTranslations("common");
  const tfn = useTranslations("app.functions");
  const ta = useTranslations("app.aircraft");
  const router = useRouter();
  const airports = useAirports();
  const aircraftList = useTable("aircraft");
  const allFlights = useFlights();
  // the operator recognised from the aircraft, the call sign and the logbook (shown until one is typed)
  const airlines = useAirlineDirectory();
  const operators = useMemo(() => operatorIndex(allFlights ?? [], aircraftList ?? [], airlines), [allFlights, aircraftList, airlines]);
  const types = useTypes();
  const dur = useDuration();
  const { toast, toastNode } = useToast();

  const [v, setV] = useState<FlightFormInput>(() => (flight ? flightToInput(flight) : { ...blank(pilot), ...prefill }));
  const [nightManual, setNightManual] = useState(flight?.nightCalc === "manual");
  const [ifrManual, setIfrManual] = useState(!!flight && flight.ifrMin > 0 && flight.ifrMin !== flight.totalMin);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const access = useAccess();
  const set = <K extends keyof FlightFormInput>(k: K, val: FlightFormInput[K]) => setV((s) => ({ ...s, [k]: val }));

  // Pilot defaults arrive asynchronously for new flights.
  useEffect(() => {
    if (!flight && pilot && !prefill) setV((s) => ({ ...s, function: pilot.defaultFunction, depIcao: s.depIcao || pilot.homeBaseIcao || "" }));
  }, [pilot, flight, prefill]);

  const aircraft: Aircraft | undefined = useMemo(
    () => aircraftList?.find((a) => a.id === v.aircraftId) ?? aircraftList?.find((a) => a.registration === v.registration?.toUpperCase()),
    [aircraftList, v.aircraftId, v.registration],
  );
  const type = types ? findType(types, aircraft?.aircraftTypeId ?? v.aircraftTypeIcao) : undefined;

  // IFR default follows the aircraft when the pilot preference is "by aircraft".
  useEffect(() => {
    if (!flight && pilot?.defaultIfr === "ask" && type) setV((s) => ({ ...s, ifr: defaultIfrFor("ask", type) }));
  }, [type, pilot?.defaultIfr, flight]);

  const preview = useMemo(() => {
    if (!airports) return null;
    return deriveFlightTimes(
      { ...v, nightOverrideMin: nightManual ? v.nightOverrideMin ?? 0 : undefined, ifrOverrideMin: ifrManual ? v.ifrOverrideMin : undefined },
      { airports: (c) => airports.get(c), aircraftType: type, aircraft },
    );
  }, [v, airports, type, aircraft, nightManual, ifrManual]);

  async function submit(again: boolean) {
    setError("");
    if (!v.date || (!v.isFstd && (!v.depIcao || !v.arrIcao))) return setError(t("required"));
    if (!airports) return;
    setBusy(true);
    const input: FlightFormInput = {
      ...v,
      aircraftId: aircraft?.id ?? null,
      registration: v.registration?.trim().toUpperCase() || aircraft?.registration,
      aircraftTypeIcao: type?.icao ?? v.aircraftTypeIcao,
      nightOverrideMin: nightManual ? v.nightOverrideMin ?? 0 : undefined,
      ifrOverrideMin: ifrManual ? v.ifrOverrideMin : undefined,
      depIcao: v.isFstd ? v.depIcao || "FSTD" : v.depIcao,
      arrIcao: v.isFstd ? v.arrIcao || "FSTD" : v.arrIcao,
      operator: v.operator?.trim() || (v.isFstd ? undefined : operators.of({ flightNumber: v.flightNumber, registration: v.registration?.trim().toUpperCase() || aircraft?.registration })),
    };
    const saved = await saveFlight(input, airports, { id: flight?.id, source, rosterEventId });
    // a new flight: what it brought to the logbook
    if (!flight) announceGains([saved.id]);
    setBusy(false);
    toast(t("saved"));
    if (again) {
      // Next leg: depart from where we landed, keep the aircraft and crew.
      const next = { ...blank(pilot), date: saved.date, depIcao: saved.arrIcao, aircraftId: saved.aircraftId, registration: saved.registration, aircraftTypeIcao: saved.aircraftTypeIcao, function: saved.function, picName: saved.picName, ifr: saved.ifrMin > 0, pilotFlying: pilot?.defaultPilotFlying === "alternate" ? !saved.pilotFlying : saved.pilotFlying };
      setV(next);
      setNightManual(false);
      setIfrManual(false);
      if (flight) router.push("/app/carnet/nouveau");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/app/carnet");
    }
  }

  const unknownAirport = !v.isFstd && airports && ((v.depIcao.length >= 3 && !airports.get(v.depIcao)) || (v.arrIcao.length >= 3 && !airports.get(v.arrIcao)));
  const recognisedOperator = v.isFstd ? undefined : operators.of({ flightNumber: v.flightNumber, registration: v.registration });
  // the great-circle distance of the leg, and the time between each pair of clocks (taxi out, air, taxi in)
  const routeNm = (() => {
    const a = airports?.get(v.depIcao);
    const b = airports?.get(v.arrIcao);
    return a && b && a.icao !== b.icao ? Math.round(distanceNm(a, b)) : 0;
  })();
  const mins = (x?: string) => (x && /^\d{2}:\d{2}$/.test(x) ? +x.slice(0, 2) * 60 + +x.slice(3) : null);
  const legs = (["out", "off", "on", "in"] as const).slice(0, 3).map((k, i) => {
    const a = mins(v[k]);
    const b = mins(v[(["off", "on", "in"] as const)[i]!]);
    return a === null || b === null ? null : (b - a + 1440) % 1440;
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="grid gap-5 lg:grid-cols-[1fr_300px]"
    >
      <div className="space-y-5">
        {flight?.locked && (
          <p className="flex items-center gap-2 rounded-lg border border-caution/40 bg-caution/10 px-4 py-2.5 text-sm text-caution">
            <Lock size={16} /> {t("locked")}
          </p>
        )}
        {source === "roster" && <p className="rounded-lg bg-accent/10 px-4 py-2 text-sm text-accent">{t("fromRoster")}</p>}

        <section className="flight-hero card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
            <Segmented
              value={v.isFstd ? "fstd" : "flight"}
              onChange={(x) => set("isFstd", x === "fstd")}
              options={[
                { value: "flight", label: <span className="inline-flex items-center gap-1.5"><Plane size={14} /> {t("kindFlight")}</span> },
                { value: "fstd", label: <span className="inline-flex items-center gap-1.5"><MonitorPlay size={14} /> {t("kindFstd")}</span> },
              ]}
            />
            <ReportPaste
              onApply={(rep) => {
                const icao = (c?: string) => (c ? airports?.get(c)?.icao : undefined);
                const reg = rep.registration?.toUpperCase();
                // aircraft known under that registration (with or without its dash)
                const plane = reg ? aircraftList?.find((a) => a.registration.toUpperCase().replace(/[^A-Z0-9]/g, "") === reg.replace(/[^A-Z0-9]/g, "")) : undefined;
                const tookOff = isPilot(rep.takeoffBy ?? rep.pilotFlying, pilot?.fullName);
                const landed = isPilot(rep.landingBy ?? rep.pilotFlying, pilot?.fullName);
                const named = !!(rep.takeoffBy || rep.landingBy || rep.pilotFlying);
                setV((s) => ({
                  ...s,
                  date: rep.date ?? s.date,
                  flightNumber: rep.flightNumber ?? s.flightNumber,
                  depIcao: icao(rep.from) ?? s.depIcao,
                  arrIcao: icao(rep.to) ?? s.arrIcao,
                  out: rep.out ?? s.out,
                  off: rep.off ?? s.off,
                  on: rep.on ?? s.on,
                  in: rep.in ?? s.in,
                  registration: plane?.registration ?? reg ?? s.registration,
                  aircraftId: plane?.id ?? (reg ? null : s.aircraftId),
                  aircraftTypeIcao: plane ? findType(types ?? [], plane.aircraftTypeId)?.icao : s.aircraftTypeIcao,
                  // who flew it, when the report names the pilots
                  ...(named ? { pilotFlying: tookOff || landed, takeoffsDay: tookOff ? 1 : 0, takeoffsNight: 0, landingsDay: landed ? 1 : 0, landingsNight: 0, autoLandings: landed } : {}),
                }));
              }}
            />
          </header>
          {/* a new flight of today or yesterday: registration, then the times and airports seen by the ADS-B network */}
          {!flight && !v.isFstd && (
            <div className="mx-5 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
              <Radar size={18} className="shrink-0 text-accent" aria-hidden />
              {/* the explanation keeps a readable width: on a phone the field and the button go below it */}
              <div className="min-w-[13rem] flex-1">
                <p className="text-sm font-semibold">{t("adsbTitle")}</p>
                <p className="text-xs text-muted">{t("adsbHint")}</p>
              </div>
              <input
                className="input num !w-32 uppercase"
                placeholder="F-GXXX"
                aria-label={t("registration")}
                value={v.registration ?? ""}
                onChange={(e) => setV((s) => ({ ...s, registration: e.target.value.toUpperCase(), aircraftId: null }))}
              />
              <FlightAwareFill prominent hex={aircraft?.icaoHex} registration={v.registration} date={v.date} onPick={(f) =>
                    setV((s) => ({
                      ...s,
                      date: f.date ?? s.date,
                      // the airline's flight number (AF1234), else the callsign (AJD19ST) unless it is only the registration; a number typed in is kept
                      flightNumber: s.flightNumber || (f.ident && norm(f.ident) !== norm(s.registration ?? "") ? f.ident : s.flightNumber),
                      depIcao: f.dep ?? s.depIcao,
                      arrIcao: f.arr ?? s.arrIcao,
                      out: f.out ?? s.out,
                      off: f.off ?? s.off,
                      on: f.on ?? s.on,
                      in: f.in ?? s.in,
                    }))} />
            </div>
          )}
          {!v.isFstd && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 px-5 pt-5 sm:gap-4">
              <AirportInput big label={t("dep")} value={v.depIcao} onChange={(x) => set("depIcao", x)} required />
              <div className="flex min-w-16 flex-col items-center pt-7 sm:min-w-40">
                <div className="route-line relative h-px w-full">
                  <Plane size={18} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 text-accent drop-shadow-[0_0_8px_var(--accent)]" />
                </div>
                {routeNm ? <p className="num mt-3 text-xs font-semibold text-muted">{routeNm.toLocaleString()} NM</p> : null}
              </div>
              <AirportInput big align="right" label={t("arr")} value={v.arrIcao} onChange={(x) => set("arrIcao", x)} required />
            </div>
          )}
          {unknownAirport && <p className="px-5 text-xs text-caution">{t("unknownAirport")}</p>}
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-dashed border-border bg-surface-2/40 px-5 py-4">
            <Field label={t("date")}>
              <input type="date" className="input num" required value={v.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label={t("flightNumber")}>
              <input className="input num uppercase" placeholder="AF1234" value={v.flightNumber ?? ""} onChange={(e) => set("flightNumber", e.target.value.toUpperCase())} />
            </Field>
          </div>
        </section>

        {v.isFstd ? (
          <Card title={<SectionTitle icon={MonitorPlay}>{t("fstdTitle")}</SectionTitle>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("fstdType")}>
                <input className="input" placeholder="A320 FFS" value={v.fstdType ?? ""} onChange={(e) => set("fstdType", e.target.value)} />
              </Field>
              <Field label={t("fstdQualification")}>
                <input className="input" placeholder="FFS D" value={v.fstdQualification ?? ""} onChange={(e) => set("fstdQualification", e.target.value)} />
              </Field>
              <Field label={t("fstdMin")}>
                <DurationInput value={v.fstdMin} onChange={(m) => set("fstdMin", m)} />
              </Field>
            </div>
          </Card>
        ) : (
          <>
            <Card
              title={<SectionTitle icon={Clock}>{t("timesTitle")}</SectionTitle>}
              action={
                <FlightAwareFill
                  hex={aircraft?.icaoHex}
                  registration={v.registration}
                  date={v.date}
                  onPick={(f) =>
                    setV((s) => ({
                      ...s,
                      date: f.date ?? s.date,
                      // the airline's flight number (AF1234), else the callsign (AJD19ST) unless it is only the registration; a number typed in is kept
                      flightNumber: s.flightNumber || (f.ident && norm(f.ident) !== norm(s.registration ?? "") ? f.ident : s.flightNumber),
                      depIcao: f.dep ?? s.depIcao,
                      arrIcao: f.arr ?? s.arrIcao,
                      out: f.out ?? s.out,
                      off: f.off ?? s.off,
                      on: f.on ?? s.on,
                      in: f.in ?? s.in,
                    }))
                  }
                />
              }
            >
              <div className="timeline relative grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {(["out", "off", "on", "in"] as const).map((k, i) => (
                  <div key={k} className="relative">
                    <p className="mb-2 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                      <span className={`timeline-dot ${v[k] ? "on" : ""}`} />
                      {t(k)}
                    </p>
                    <ClockInput value={v[k]} onChange={(x) => set(k, x)} aria-label={t(k)} className="!text-lg font-semibold" />
                    {i < 3 && legs[i] !== null && (
                      <span className="num pointer-events-none absolute -right-1 top-[3.05rem] hidden sm:block z-10 translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/40 bg-surface px-1.5 py-px text-[10px] font-semibold text-accent shadow-sm sm:-right-2">
                        {dur(legs[i]!)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card title={<SectionTitle icon={Plane}>{t("aircraftTitle")}</SectionTitle>}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field label={t("aircraft")}>
                  <input
                    className="input num uppercase"
                    list="geardown-aircraft"
                    value={v.registration ?? ""}
                    placeholder="F-XXXX"
                    onChange={(e) => {
                      const reg = e.target.value.toUpperCase();
                      const a = aircraftList?.find((x) => x.registration === reg);
                      setV((s) => ({ ...s, registration: reg, aircraftId: a?.id ?? null, aircraftTypeIcao: a ? findType(types ?? [], a.aircraftTypeId)?.icao : s.aircraftTypeIcao }));
                    }}
                  />
                  <datalist id="geardown-aircraft">
                    {aircraftList?.map((a) => (
                      <option key={a.id} value={a.registration}>
                        {findType(types ?? [], a.aircraftTypeId)?.icao}
                      </option>
                    ))}
                  </datalist>
                </Field>
                <Field label={ta("type")} hint={type ? `${type.manufacturer} ${type.model} · ${type.classOrTypeRating ?? ""}` : undefined}>
                  <input
                    className="input num uppercase"
                    list="geardown-types"
                    value={aircraft ? (type?.icao ?? "") : (v.aircraftTypeIcao ?? "")}
                    disabled={!!aircraft}
                    onChange={(e) => set("aircraftTypeIcao", e.target.value.toUpperCase())}
                  />
                  <datalist id="geardown-types">
                    {types?.map((ty) => (
                      <option key={ty.id} value={ty.icao}>
                        {ty.manufacturer} {ty.model}
                      </option>
                    ))}
                  </datalist>
                </Field>
                <Field label={t("operator")} hint={!v.operator && recognisedOperator ? t("operatorRecognised") : undefined}>
                  <OperatorInput value={v.operator ?? ""} onChange={(x) => set("operator", x || undefined)} known={operators.all} placeholder={recognisedOperator ?? t("operatorPh")} />
                </Field>
                <Field label={t("operation")}>
                  <Segmented
                    value={v.operation ?? aircraft?.defaultOperation ?? (type?.multiPilot ? "multi_pilot" : "single_pilot")}
                    onChange={(x) => set("operation", x)}
                    options={[
                      { value: "single_pilot", label: t("singlePilot") },
                      { value: "multi_pilot", label: t("multiPilot") },
                    ]}
                  />
                </Field>
                {(v.operation ?? aircraft?.defaultOperation ?? (type?.multiPilot ? "multi_pilot" : "single_pilot")) === "multi_pilot" && (
                  <Field label={t("loggedShare")} hint={t("loggedShareHint")}>
                    <Segmented
                      value={shareLabel(v.loggedShare ?? 1)}
                      onChange={(x) => set("loggedShare", LOGGED_SHARES.find((sh) => shareLabel(sh) === x) === 1 ? undefined : LOGGED_SHARES.find((sh) => shareLabel(sh) === x))}
                      options={LOGGED_SHARES.map((sh) => ({ value: shareLabel(sh), label: sh === 1 ? t("loggedAll") : shareLabel(sh) }))}
                    />
                  </Field>
                )}
              </div>
              <AircraftPhoto registration={v.registration} hex={aircraft?.icaoHex} showEmpty className="mt-4 max-w-md" />
            </Card>
          </>
        )}

        <Card title={<SectionTitle icon={Users}>{t("crewTitle")}</SectionTitle>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("function")}>
              <select className="input" value={v.function} onChange={(e) => set("function", e.target.value as FlightFormInput["function"])}>
                {PILOT_FUNCTIONS.map((f) => (
                  <option key={f} value={f}>
                    {tfn(f)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("picName")}>
              <input className="input" disabled={v.function === "PIC"} placeholder={v.function === "PIC" ? t("picSelf") : ""} value={v.function === "PIC" ? "" : (v.picName ?? "")} onChange={(e) => set("picName", e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Toggle checked={v.pilotFlying} onChange={(x) => set("pilotFlying", x)} label={t("pilotFlying")} />
          </div>
        </Card>

        {!v.isFstd && (
          <Card title={<SectionTitle icon={CloudSun}>{t("conditionsTitle")}</SectionTitle>}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <Toggle checked={v.ifr} onChange={(x) => set("ifr", x)} label={t("ifr")} />
                <Toggle checked={ifrManual} onChange={setIfrManual} label={t("ifrMin")} disabled={!v.ifr} />
                {ifrManual && v.ifr && <DurationInput value={v.ifrOverrideMin} onChange={(m) => set("ifrOverrideMin", m)} />}
              </div>
              <div className="space-y-3">
                <Toggle checked={!nightManual} onChange={(x) => setNightManual(!x)} label={t("nightAuto")} />
                {nightManual && (
                  <Field label={t("nightMin")}>
                    <DurationInput value={v.nightOverrideMin} onChange={(m) => set("nightOverrideMin", m)} />
                  </Field>
                )}
              </div>
              <Field label={t("actualImc")}>
                <DurationInput value={v.actualImcMin || undefined} onChange={(m) => set("actualImcMin", m)} />
              </Field>
              <Field label={t("xc")}>
                <DurationInput value={v.xcMin || undefined} onChange={(m) => set("xcMin", m)} />
              </Field>
            </div>
          </Card>
        )}

        {!v.isFstd && (
          <Card title={<SectionTitle icon={PlaneLanding}>{t("landingsTitle")}</SectionTitle>}>
            <Toggle checked={!!v.autoLandings} onChange={(x) => set("autoLandings", x)} label={t("autoLandings")} />
            {!v.autoLandings && (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(["takeoffsDay", "takeoffsNight", "landingsDay", "landingsNight"] as const).map((k, i) => (
                  <Field key={k} label={t((["toDay", "toNight", "ldgDay", "ldgNight"] as const)[i]!)}>
                    <input type="number" min={0} max={99} className="input num" value={v[k] ?? 0} onChange={(e) => set(k, Math.max(0, Number(e.target.value) || 0))} />
                  </Field>
                ))}
              </div>
            )}
          </Card>
        )}

        <ExtraEntries v={v} set={set} pilot={pilot} />

        <Card title={<SectionTitle icon={Radar}>{t("approachesTitle")}</SectionTitle>}>
          <ApproachList value={v.approaches ?? []} onChange={(a) => set("approaches", a)} />
        </Card>

        <Card title={<SectionTitle icon={NotebookPen}>{t("remarks")}</SectionTitle>}>
          <textarea className="input" rows={3} value={v.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} />
        </Card>
      </div>

      {/* Live computed panel */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          <div className="computed-head relative overflow-hidden px-5 pb-5 pt-4 text-white">
            <p className="label-caps !text-white/60">{t("computed")}</p>
            {!v.isFstd && (v.depIcao || v.arrIcao) ? (
              <p className="num mt-1 text-sm font-semibold tracking-wider text-white/85">
                {v.depIcao || "····"} <span className="text-white/40">→</span> {v.arrIcao || "····"}
              </p>
            ) : null}
            <p className="num mt-1 text-5xl font-bold tracking-tight"><Roll>{v.isFstd ? dur(v.fstdMin ?? 0) : dur(preview?.totalMin ?? 0)}</Roll></p>
            <p className="text-xs uppercase tracking-[0.14em] text-white/60">{v.isFstd ? "FSTD" : t("block")}</p>
            {!v.isFstd && preview && preview.totalMin > 0 && (
              <div className="mt-3">
                <Meter value={preview.airMin} max={preview.totalMin} level="ok" />
                <p className="num mt-1 text-[11px] text-white/60">{t("air")} {dur(preview.airMin)}</p>
              </div>
            )}
          </div>
          {!v.isFstd && preview && (
            <dl className="grid grid-cols-2 gap-2 p-4 text-sm">
              <Stat k={t("air")} v={preview.airMin} />
              <Stat k={t("night")} v={preview.nightMin} accent />
              <Stat k={t("ifrShort")} v={preview.ifrMin} />
              <Stat k={tfn(v.function).split(" (")[0]!} v={preview.picMin + preview.picusMin + preview.copilotMin + preview.dualMin + preview.instructorMin + preview.examinerMin} />
              <Stat k={t("sePilot")} v={preview.singlePilotSeMin} />
              <Stat k={t("mePilot")} v={preview.singlePilotMeMin} />
              <Stat k={t("mpPilot")} v={preview.multiPilotMin} />
              <Stat k={t("ldg")} text={`${preview.landingsDay} / ${preview.landingsNight}`} on={preview.landingsDay + preview.landingsNight > 0} />
            </dl>
          )}
          <div className="space-y-2 border-t border-border p-4">
            {error && <p className="text-sm text-warning">{error}</p>}
            {!access.canWrite && <p className="text-sm text-muted">{tacc("readOnlyShort")}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={busy || !airports || !access.canWrite}>
              {tc("save")}
            </button>
            <button type="button" className="btn btn-secondary w-full" disabled={busy || !airports || !access.canWrite} onClick={() => submit(true)}>
              {t("saveAndNew")}
            </button>
          </div>
        </div>

        {flight && (
          <div className="card mt-4 space-y-2 p-4">
            <SignatureStatus flight={flight} />
            {access.has("signature") ? <SignWithSavedButton flight={flight} /> : null}
            {!flight.signatureId && access.has("signature") && (
              <button type="button" className="btn btn-secondary w-full" onClick={() => setSignOpen(true)}>
                <PenLine size={16} /> {t("sign")}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push({ pathname: "/app/carnet/nouveau", query: { from: flight.id, mode: "duplicate" } })}>
                <Copy size={14} /> {t("duplicate")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push({ pathname: "/app/carnet/nouveau", query: { from: flight.id, mode: "return" } })}>
                <CornerUpLeft size={14} /> {t("returnFlight")}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-danger btn-sm w-full"
              onClick={async () => {
                if (!confirm(tc("confirmDelete"))) return;
                await softDelete("flights", flight.id);
                if (flight.rosterEventId) {
                  const ev = await db().t("roster_events").get(flight.rosterEventId);
                  if (ev) await db().t("roster_events").put({ ...ev, flightId: null, updatedAt: new Date().toISOString() });
                }
                router.push("/app/carnet");
              }}
            >
              <Trash2 size={14} /> {tc("delete")}
            </button>
            <FlightHistory flight={flight} />
          </div>
        )}
      </aside>
      {flight && <SignatureModal open={signOpen} onClose={() => setSignOpen(false)} flight={flight} />}
      {toastNode}
    </form>
  );
}

function Stat({ k, v, text, accent, on }: { k: string; v?: number; text?: string; accent?: boolean; on?: boolean }) {
  const dur = useDuration();
  const lit = on ?? (v ?? 0) > 0;
  return (
    <div className={`rounded-lg border px-3 py-2 transition-colors ${lit ? "border-accent/30 bg-accent/[0.06]" : "border-border bg-surface-2/40"}`}>
      <dt className="truncate text-[11px] text-muted">{k}</dt>
      <dd className={`num text-base font-semibold ${lit ? (accent ? "text-accent" : "") : "opacity-40"}`}>{text ?? dur(v ?? 0)}</dd>
    </div>
  );
}

/** A section title with its icon. */
function SectionTitle({ icon: Icon, children }: { icon: typeof Plane; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/12 text-accent">
        <Icon size={15} aria-hidden />
      </span>
      {children}
    </span>
  );
}

function ApproachList({ value, onChange }: { value: Approach[]; onChange: (a: Approach[]) => void }) {
  const t = useTranslations("app.form");
  return (
    <div className="space-y-2">
      {value.map((a, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_80px_70px_auto] gap-2">
          <select className="input" aria-label={t("approachType")} value={a.type} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
            {APPROACH_TYPES.map((ty) => (
              <option key={ty}>{ty}</option>
            ))}
          </select>
          <input className="input num uppercase" aria-label={t("approachAirport")} placeholder="LFPB" maxLength={4} value={a.airport ?? ""} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, airport: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") || undefined } : x)))} />
          <input className="input num uppercase" aria-label={t("runway")} placeholder="27R" value={a.runway ?? ""} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, runway: e.target.value.toUpperCase() } : x)))} />
          <input type="number" min={1} className="input num" aria-label={t("count")} value={a.count} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, count: Math.max(1, Number(e.target.value) || 1) } : x)))} />
          <button type="button" className="btn btn-ghost !px-2" aria-label="remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X size={16} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...value, { type: "ILS CAT I", count: 1 }])}>
        <Plus size={14} /> {t("addApproach")}
      </button>
    </div>
  );
}

/**
 * Entries some authorities require beyond the EASA columns (FAA, CASA, New Zealand, Canada): shown open when the
 * pilot's authority asks for them, folded otherwise.
 */
function ExtraEntries({ v, set, pilot }: { v: FlightFormInput; set: <K extends keyof FlightFormInput>(k: K, val: FlightFormInput[K]) => void; pilot?: Pilot }) {
  const t = useTranslations("app.form.extra");
  const wanted = extraFieldsFor(pilot ? frameworkOf(pilot) : undefined, pilot?.authority);
  const filled = EXTRA_FLIGHT_FIELDS.some((k) => { const x = v[k]; return Array.isArray(x) ? x.length > 0 : !!x; });
  const [open, setOpen] = useState(wanted.length > 0 || filled);
  // the stops as typed (spaces kept while typing), the parsed list goes to the flight
  const [viaText, setViaText] = useState((v.via ?? []).join(" "));
  const order = [...wanted, ...EXTRA_FLIGHT_FIELDS.filter((k) => !wanted.includes(k))];
  const field = (k: (typeof EXTRA_FLIGHT_FIELDS)[number]) => {
    switch (k) {
      case "simInstrumentMin":
      case "groundTrainingMin":
      case "soloMin":
        return <DurationInput value={v[k] || undefined} onChange={(m) => set(k, m)} />;
      case "holdings":
        return <input type="number" min={0} max={99} className="input num" value={v.holdings ?? ""} onChange={(e) => set("holdings", Math.max(0, Number(e.target.value) || 0) || undefined)} />;
      case "via":
        return <input className="input num uppercase" placeholder="LFLY LFMN" value={viaText} onChange={(e) => { const x = e.target.value.toUpperCase(); setViaText(x); set("via", x.split(/[\s,;-]+/).filter(Boolean)); }} />;
      default:
        return <input className="input" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} />;
    }
  };
  return (
    <Card title={t("title")}>
      <p className="-mt-1 text-xs text-muted">{wanted.length ? t("hintAuthority", { authority: pilot?.authority ?? "" }) : t("hint")}</p>
      {open ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {order.map((k) => (
            <Field key={k} label={t(k)} hint={k === "groundTrainingMin" ? t("groundHint") : undefined}>
              {field(k)}
            </Field>
          ))}
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setOpen(true)}>
          <Plus size={14} /> {t("show")}
        </button>
      )}
    </Card>
  );
}
