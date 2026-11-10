"use client";

import { Copy, CornerUpLeft, Lock, PenLine, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  defaultIfrFor, deriveFlightTimes, isoDate, PILOT_FUNCTIONS, type Aircraft, type Approach, type Flight, type FlightFormInput, type Pilot,
} from "@cielo/core";
import { useRouter } from "@/i18n/navigation";
import { useAirports } from "@/lib/airports";
import { useDuration, useTable, useTypes } from "@/lib/hooks";
import { findType, flightToInput, saveFlight, softDelete } from "@/lib/repo";
import { db } from "@/lib/db";
import { AirportInput } from "./AirportInput";
import { Card, ClockInput, DurationInput, Field, Segmented, Toggle, useToast } from "./ui";
import { SignatureModal, SignatureStatus } from "./Signature";

const APPROACH_TYPES = ["ILS CAT I", "ILS CAT II", "ILS CAT III", "LOC", "RNP", "RNP AR", "LPV", "VOR", "NDB", "GLS", "PAR", "Visual", "Circling"];

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
  const tc = useTranslations("common");
  const tfn = useTranslations("app.functions");
  const ta = useTranslations("app.aircraft");
  const router = useRouter();
  const airports = useAirports();
  const aircraftList = useTable("aircraft");
  const types = useTypes();
  const dur = useDuration();
  const { toast, toastNode } = useToast();

  const [v, setV] = useState<FlightFormInput>(() => (flight ? flightToInput(flight) : { ...blank(pilot), ...prefill }));
  const [nightManual, setNightManual] = useState(flight?.nightCalc === "manual");
  const [ifrManual, setIfrManual] = useState(!!flight && flight.ifrMin > 0 && flight.ifrMin !== flight.totalMin);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
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
    };
    const saved = await saveFlight(input, airports, { id: flight?.id, source, rosterEventId });
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

        <Card title={t("general")}>
          <div className="mb-4">
            <Toggle checked={v.isFstd} onChange={(x) => set("isFstd", x)} label={t("isFstd")} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label={t("date")} className="col-span-1">
              <input type="date" className="input num" required value={v.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label={t("flightNumber")}>
              <input className="input num uppercase" value={v.flightNumber ?? ""} onChange={(e) => set("flightNumber", e.target.value.toUpperCase())} />
            </Field>
            {!v.isFstd && (
              <>
                <AirportInput label={t("dep")} value={v.depIcao} onChange={(x) => set("depIcao", x)} required />
                <AirportInput label={t("arr")} value={v.arrIcao} onChange={(x) => set("arrIcao", x)} required />
              </>
            )}
          </div>
          {unknownAirport && <p className="mt-1 text-xs text-caution">{t("unknownAirport")}</p>}
        </Card>

        {v.isFstd ? (
          <Card title={t("fstdTitle")}>
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
            <Card title={t("timesTitle")}>
              <div className="grid grid-cols-4 gap-2 sm:gap-4">
                {(["out", "off", "on", "in"] as const).map((k) => (
                  <Field key={k} label={t(k)}>
                    <ClockInput value={v[k]} onChange={(x) => set(k, x)} aria-label={t(k)} />
                  </Field>
                ))}
              </div>
            </Card>

            <Card title={t("aircraftTitle")}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("aircraft")}>
                  <input
                    className="input num uppercase"
                    list="cielo-aircraft"
                    value={v.registration ?? ""}
                    placeholder="F-XXXX"
                    onChange={(e) => {
                      const reg = e.target.value.toUpperCase();
                      const a = aircraftList?.find((x) => x.registration === reg);
                      setV((s) => ({ ...s, registration: reg, aircraftId: a?.id ?? null, aircraftTypeIcao: a ? findType(types ?? [], a.aircraftTypeId)?.icao : s.aircraftTypeIcao }));
                    }}
                  />
                  <datalist id="cielo-aircraft">
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
                    list="cielo-types"
                    value={aircraft ? (type?.icao ?? "") : (v.aircraftTypeIcao ?? "")}
                    disabled={!!aircraft}
                    onChange={(e) => set("aircraftTypeIcao", e.target.value.toUpperCase())}
                  />
                  <datalist id="cielo-types">
                    {types?.map((ty) => (
                      <option key={ty.id} value={ty.icao}>
                        {ty.manufacturer} {ty.model}
                      </option>
                    ))}
                  </datalist>
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
              </div>
            </Card>
          </>
        )}

        <Card title={t("crewTitle")}>
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
          <Card title={t("conditionsTitle")}>
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
          <Card title={t("landingsTitle")}>
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

        <Card title={t("approachesTitle")}>
          <ApproachList value={v.approaches ?? []} onChange={(a) => set("approaches", a)} />
        </Card>

        <Card title={t("remarks")}>
          <textarea className="input" rows={3} value={v.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} />
        </Card>
      </div>

      {/* Live computed panel */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          <div className="border-b border-border bg-brand px-5 py-3 text-white">
            <p className="label-caps !text-white/60">{t("computed")}</p>
            <p className="num mt-1 text-3xl font-semibold">{v.isFstd ? dur(v.fstdMin ?? 0) : dur(preview?.totalMin ?? 0)}</p>
            <p className="text-xs text-white/60">{v.isFstd ? "FSTD" : t("block")}</p>
          </div>
          {!v.isFstd && preview && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-sm">
              <Stat k={t("air")} v={dur(preview.airMin)} />
              <Stat k={t("night")} v={dur(preview.nightMin)} accent={preview.nightMin > 0} />
              <Stat k={t("ifrShort")} v={dur(preview.ifrMin)} />
              <Stat k={tfn(v.function).split(" (")[0]!} v={dur(preview.picMin + preview.picusMin + preview.copilotMin + preview.dualMin + preview.instructorMin + preview.examinerMin)} />
              <Stat k={t("sePilot")} v={dur(preview.singlePilotSeMin)} />
              <Stat k={t("mePilot")} v={dur(preview.singlePilotMeMin)} />
              <Stat k={t("mpPilot")} v={dur(preview.multiPilotMin)} />
              <Stat k={t("ldg")} v={`${preview.landingsDay} / ${preview.landingsNight}`} />
            </dl>
          )}
          <div className="space-y-2 border-t border-border p-4">
            {error && <p className="text-sm text-warning">{error}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={busy || !airports}>
              {tc("save")}
            </button>
            <button type="button" className="btn btn-secondary w-full" disabled={busy || !airports} onClick={() => submit(true)}>
              {t("saveAndNew")}
            </button>
          </div>
        </div>

        {flight && (
          <div className="card mt-4 space-y-2 p-4">
            <SignatureStatus flight={flight} />
            {!flight.signatureId && (
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
          </div>
        )}
      </aside>
      {flight && <SignatureModal open={signOpen} onClose={() => setSignOpen(false)} flight={flight} />}
      {toastNode}
    </form>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{k}</dt>
      <dd className={`num text-base font-semibold ${accent ? "text-accent" : ""}`}>{v}</dd>
    </div>
  );
}

function ApproachList({ value, onChange }: { value: Approach[]; onChange: (a: Approach[]) => void }) {
  const t = useTranslations("app.form");
  return (
    <div className="space-y-2">
      {value.map((a, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_70px_auto] gap-2">
          <select className="input" aria-label={t("approachType")} value={a.type} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
            {APPROACH_TYPES.map((ty) => (
              <option key={ty}>{ty}</option>
            ))}
          </select>
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
