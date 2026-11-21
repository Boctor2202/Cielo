"use client";

import { PenLine, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { autoSignDue, type Flight, type Signature } from "@cielo/core";
import { removeSignature, signFlight, signWithSaved, updatePilot, verifySignature } from "@/lib/repo";
import { useDuration, useFlights, useFormatDate, usePilot } from "@/lib/hooks";
import { useAccess } from "@/lib/access";
import { Link } from "@/i18n/navigation";
import { Field, Modal, Toggle } from "./ui";

export function SignatureStatus({ flight }: { flight: Flight }) {
  const t = useTranslations("app.signature");
  const fd = useFormatDate();
  const [state, setState] = useState<{ sig?: Signature; valid: boolean } | null>(null);
  useEffect(() => {
    verifySignature(flight).then(setState);
  }, [flight]);
  if (!flight.signatureId || !state?.sig) return null;
  const s = state.sig;
  return (
    <div className={`rounded-lg border p-3 text-sm ${state.valid ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}`}>
      <p className={`flex items-center gap-2 font-semibold ${state.valid ? "text-success" : "text-warning"}`}>
        {state.valid ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />} {state.valid ? t("valid") : t("invalid")}
      </p>
      <p className="mt-1 text-xs text-muted">{t("signedBy", { name: s.signerName, role: t(`roles.${s.signerRole}`), date: fd(s.signedAt, { dateStyle: "medium", timeStyle: "short" }) })}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.imageDataUrl} alt="" className="mt-2 h-14 rounded bg-white p-1" />
      <p className="num mt-1 truncate text-[10px] text-muted" title={s.contentHash}>
        SHA-256 {s.contentHash.slice(0, 24)}…
      </p>
      <button type="button" className="mt-2 text-xs font-semibold text-muted underline" onClick={() => removeSignature(flight)}>
        {t("remove")}
      </button>
    </div>
  );
}

export function SignatureModal({ open, onClose, flight }: { open: boolean; onClose: () => void; flight: Flight }) {
  const t = useTranslations("app.signature");
  const tc = useTranslations("common");
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState(flight.picName ?? "");
  const [role, setRole] = useState<Signature["signerRole"]>(flight.function === "DUAL" ? "instructor" : "captain");
  const [licence, setLicence] = useState("");

  useEffect(() => {
    if (!open) return;
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a1626";
    setHasInk(false);
  }, [open]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("signerName")}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("signerRole")}>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Signature["signerRole"])}>
              {(["instructor", "captain", "examiner", "other"] as const).map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("licence")} className="sm:col-span-2">
            <input className="input num" value={licence} onChange={(e) => setLicence(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-muted">{t("draw")}</p>
          <canvas
            ref={canvas}
            className="h-40 w-full touch-none rounded-lg border border-border bg-white"
            onPointerDown={(e) => {
              drawing.current = true;
              const ctx = canvas.current!.getContext("2d")!;
              const [x, y] = pos(e);
              ctx.beginPath();
              ctx.moveTo(x, y);
              canvas.current!.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = canvas.current!.getContext("2d")!;
              const [x, y] = pos(e);
              ctx.lineTo(x, y);
              ctx.stroke();
              setHasInk(true);
            }}
            onPointerUp={() => (drawing.current = false)}
          />
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-muted underline"
            onClick={() => {
              const c = canvas.current!;
              c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
              setHasInk(false);
            }}
          >
            {t("clear")}
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tc("cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!hasInk || !name.trim()}
            onClick={async () => {
              await signFlight(flight.id, { signerName: name.trim(), signerRole: role, signerLicenceNumber: licence.trim() || undefined, imageDataUrl: canvas.current!.toDataURL("image/png") });
              onClose();
            }}
          >
            {t("confirm")}
          </button>
        </div>
        <SendLink flightId={flight.id} signerName={name} role={role} />
      </div>
    </Modal>
  );
}

/** A signing link for someone without a Geardown account (see /api/sign-link). */
function SendLink({ flightId, signerName, role }: { flightId: string; signerName: string; role: Signature["signerRole"] }) {
  const t = useTranslations("app.signature");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ url: string; mailed: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
      const r = await fetch("/api/sign-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ action: "create", flightIds: [flightId], signerName: signerName.trim(), signerRole: role, email: email.trim() || undefined, locale }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "error");
      setRes({ url: d.url, mailed: !!d.mailed });
    } catch (e) {
      setErr((e as Error).message === "plan" ? t("linkPlan") : t("linkErr"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-sm font-semibold">{t("sendLink")}</p>
      <p className="text-xs text-muted">{t("sendLinkHint")}</p>
      {res ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-success">{t("linkReady")}</p>
          {res.mailed ? <p className="text-xs text-muted">{t("linkMailed", { email })}</p> : null}
          <div className="flex gap-2">
            <input className="input num flex-1 text-xs" readOnly value={res.url} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void navigator.clipboard.writeText(res.url).then(() => (setCopied(true), setTimeout(() => setCopied(false), 2000)))}
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1" type="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="button" className="btn btn-secondary" disabled={busy || !signerName.trim()} onClick={() => void create()}>
            {t("createLink")}
          </button>
        </div>
      )}
      {err ? <p className="text-xs text-warning">{err}</p> : null}
    </div>
  );
}

/** A drawing area for a signature; `onChange` receives the PNG (or null once cleared). */
export function SignatureCanvas({ onChange, className = "" }: { onChange: (png: string | null) => void; className?: string }) {
  const t = useTranslations("app.signature");
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a1626";
  }, []);
  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  return (
    <div className={className}>
      <canvas
        ref={canvas}
        className="h-40 w-full touch-none rounded-lg border border-border bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = canvas.current!.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          canvas.current!.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvas.current!.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          onChange(canvas.current!.toDataURL("image/png"));
        }}
      />
      <button
        type="button"
        className="mt-1 text-xs font-semibold text-muted underline"
        onClick={() => {
          const c = canvas.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          onChange(null);
        }}
      >
        {t("clear")}
      </button>
    </div>
  );
}

const ROLES = ["captain", "instructor", "examiner", "other"] as const;

/**
 * Profile › My signature: drawn once, kept on the account (synced with the app), then used to sign the pilot's
 * flights, their colleagues' requests, and the logbook when it is exported.
 */
export function MySignatureCard() {
  const t = useTranslations("app.mysig");
  const ts = useTranslations("app.signature");
  const pilot = usePilot();
  const access = useAccess();
  const [drawing, setDrawing] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  if (!pilot || !access.has("signature")) return null;
  const has = !!pilot.signatureDataUrl;
  return (
    <div className="card space-y-3 p-5">
      <p className="flex items-center gap-2 font-semibold"><PenLine size={16} className="text-accent" /> {t("title")}</p>
      <p className="text-sm text-muted">{t("hint")}</p>
      {!has || drawing ? (
        <>
          <SignatureCanvas onChange={setPng} />
          {!pilot.fullName?.trim() ? <p className="text-xs text-caution">{t("needName")}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!png || !pilot.fullName?.trim()}
              onClick={async () => {
                await updatePilot({ signatureDataUrl: png!, signatureRole: pilot.signatureRole ?? "captain" });
                setDrawing(false);
                setPng(null);
              }}
            >
              {t("save")}
            </button>
            {has ? <button type="button" className="btn btn-ghost" onClick={() => setDrawing(false)}>{t("cancel")}</button> : null}
          </div>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pilot.signatureDataUrl} alt="" className="h-20 rounded-lg bg-white p-2" />
          <p className="text-xs text-muted">{[pilot.fullName, pilot.licenceNumber].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">{t("role")}</span>
            {ROLES.map((r) => (
              <button key={r} type="button" onClick={() => void updatePilot({ signatureRole: r })} className={`rounded-full px-3 py-1 text-xs font-semibold ${(pilot.signatureRole ?? "captain") === r ? "bg-accent text-black" : "border border-border text-muted"}`}>
                {ts(`roles.${r}`)}
              </button>
            ))}
          </div>
          <Toggle checked={!!pilot.autoSignFrom} onChange={(v) => void updatePilot({ autoSignFrom: v ? new Date().toISOString().slice(0, 10) : null })} label={t("auto")} />
          <p className="-mt-1 text-xs text-muted">{t("autoHint")}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDrawing(true)}>{t("redraw")}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => confirm(t("removeBody")) && void updatePilot({ signatureDataUrl: undefined, autoSignFrom: null })}>{t("remove")}</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Signs a flight with the saved signature, after a confirmation. */
export function SignWithSavedButton({ flight }: { flight: Flight }) {
  const t = useTranslations("app.mysig");
  const pilot = usePilot();
  if (!pilot?.signatureDataUrl || flight.signatureId) return null;
  return (
    <button type="button" className="btn btn-primary w-full" onClick={() => confirm(t("confirmOne", { name: pilot.fullName })) && void signWithSaved([flight.id])}>
      <PenLine size={16} /> {t("signThis")}
    </button>
  );
}

/** "Sign my flights": every unsigned flight (or a period), checked, signed in one go with the saved signature. */
export function SignManyModal({ open, onClose, flights }: { open: boolean; onClose: () => void; flights: Flight[] }) {
  const t = useTranslations("app.mysig");
  const tc = useTranslations("common");
  const fd = useFormatDate();
  const d = useDuration();
  const pilot = usePilot();
  const unsigned = useMemo(() => flights.filter((f) => !f.deletedAt && !f.signatureId).sort((a, b) => b.date.localeCompare(a.date)), [flights]);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const chosen = picked ?? new Set(unsigned.map((f) => f.id));
  const total = unsigned.filter((f) => chosen.has(f.id)).reduce((x, f) => x + f.totalMin, 0);
  const close = () => (setPicked(null), setDone(null), onClose());
  return (
    <Modal open={open} onClose={close} title={t("signMine")}>
      {!pilot?.signatureDataUrl ? (
        <p className="text-sm">{t("none")} <Link href="/app/profil" className="font-semibold text-accent underline">{t("create")}</Link></p>
      ) : done !== null ? (
        <div className="space-y-4 text-center">
          <p className="text-lg font-semibold">{t("done", { n: done })}</p>
          <button type="button" className="btn btn-primary" onClick={close}>{tc("close")}</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{t("unsigned", { n: unsigned.length })}</span>
            <button type="button" className="font-semibold text-accent" onClick={() => setPicked(chosen.size === unsigned.length ? new Set() : new Set(unsigned.map((f) => f.id)))}>
              {chosen.size === unsigned.length ? t("none_") : t("all")}
            </button>
          </div>
          <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {unsigned.map((f) => (
              <li key={f.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" className="accent-[var(--accent)]" checked={chosen.has(f.id)} onChange={() => setPicked(() => { const n = new Set(chosen); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} />
                  <span className="num font-semibold">{f.depIcao} → {f.arrIcao}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{fd(f.date, { day: "numeric", month: "short", year: "numeric" })}{f.aircraftTypeIcao ? ` · ${f.aircraftTypeIcao}` : ""}{f.registration ? ` · ${f.registration}` : ""}</span>
                  <span className="num">{d(f.totalMin)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 rounded-lg bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pilot.signatureDataUrl} alt="" className="h-10" />
            <span className="text-xs text-[#4a5d73]">{pilot.fullName}{pilot.licenceNumber ? ` · ${pilot.licenceNumber}` : ""}</span>
          </div>
          <p className="text-xs text-muted">{t("hashNote")}</p>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!chosen.size || busy}
            onClick={async () => {
              setBusy(true);
              try {
                setDone(await signWithSaved([...chosen]));
              } finally {
                setBusy(false);
              }
            }}
          >
            <PenLine size={16} /> {busy ? t("signing") : t("signN", { n: chosen.size, total: d(total) })}
          </button>
        </div>
      )}
    </Modal>
  );
}

/** The pilot's own flights, signed the day after when automatic signature is on. */
export function useAutoSign() {
  const pilot = usePilot();
  const flights = useFlights();
  const access = useAccess();
  const busy = useRef(false);
  useEffect(() => {
    if (!pilot || !flights || busy.current || !access.canWrite || !access.has("signature")) return;
    const due = autoSignDue(flights, pilot, new Date().toISOString().slice(0, 10));
    if (!due.length) return;
    busy.current = true;
    void signWithSaved(due.map((f) => f.id)).finally(() => (busy.current = false));
  }, [pilot, flights, access]);
}
