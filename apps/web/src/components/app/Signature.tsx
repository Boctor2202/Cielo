"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import type { Flight, Signature } from "@cielo/core";
import { removeSignature, signFlight, verifySignature } from "@/lib/repo";
import { useFormatDate } from "@/lib/hooks";
import { Field, Modal } from "./ui";

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
