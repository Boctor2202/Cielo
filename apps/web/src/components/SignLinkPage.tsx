"use client";

import { CheckCircle2, PenLine, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/Logo";

type Snap = { date: string; flightNumber: string | null; dep: string; arr: string; out: string | null; in: string | null; registration: string | null; type: string | null; function: string | null; totalMin: number; isFstd: boolean };
type Data = { status: "open" | "signed" | "refused" | "revoked" | "expired"; pilot: string; signerName: string; signerRole: string; expiresAt: string; flights: Snap[]; signedCount: number };

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/**
 * What a captain / instructor / examiner without a Geardown account sees from a signature link: the pilot's
 * flights, then a signature drawn once for all of them (or a refusal).
 */
export function SignLinkPage({ token }: { token: string }) {
  const t = useTranslations("signLink");
  const locale = useLocale();
  const [data, setData] = useState<Data | null | "error">(null);
  const [name, setName] = useState("");
  const [licence, setLicence] = useState("");
  const [checked, setChecked] = useState(false);
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { signed: number; changed: number } | "refused">(null);
  const [err, setErr] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    fetch(`/api/sign-link?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Data) => {
        setData(d);
        setName(d.signerName);
      })
      .catch(() => setData("error"));
  }, [token]);

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
  }, [data]);

  const fd = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/sign-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "error");
      return d;
    } catch (e) {
      setErr(t(`err.${["expired", "signed", "refused", "revoked", "rate_limited"].includes((e as Error).message) ? (e as Error).message : "generic"}` as "err.generic"));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center gap-2">
        <Logo />
      </div>
      {children}
      <p className="mt-10 text-xs text-muted">{t("footer")}</p>
    </main>
  );

  if (data === null) return shell(<p className="text-muted">{t("loading")}</p>);
  if (data === "error") return shell(<Notice icon={<XCircle className="text-warning" />} title={t("invalidTitle")} body={t("invalidBody")} />);
  if (done === "refused") return shell(<Notice icon={<XCircle className="text-muted" />} title={t("refusedTitle")} body={t("refusedBody", { pilot: data.pilot })} />);
  if (done) return shell(<Notice icon={<CheckCircle2 className="text-success" />} title={t("doneTitle", { n: done.signed })} body={done.changed ? t("doneChanged", { n: done.changed, pilot: data.pilot }) : t("doneBody", { pilot: data.pilot })} />);
  if (data.status !== "open") return shell(<Notice icon={<XCircle className="text-muted" />} title={t(`status.${data.status}`)} body={t("closedBody", { pilot: data.pilot })} />);

  const total = data.flights.reduce((s, f) => s + (f.totalMin || 0), 0);
  return shell(
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title", { pilot: data.pilot, n: data.flights.length })}</h1>
        <p className="mt-2 text-sm text-muted">{t("intro", { pilot: data.pilot, role: t(`roles.${data.signerRole}` as "roles.captain"), date: fd(data.expiresAt.slice(0, 10)) })}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">{t("col.date")}</th>
              <th className="px-3 py-2">{t("col.route")}</th>
              <th className="px-3 py-2">{t("col.times")}</th>
              <th className="px-3 py-2">{t("col.aircraft")}</th>
              <th className="px-3 py-2">{t("col.function")}</th>
              <th className="px-3 py-2 text-right">{t("col.total")}</th>
            </tr>
          </thead>
          <tbody>
            {data.flights.map((f, i) => (
              <tr key={i} className="border-t border-border">
                <td className="whitespace-nowrap px-3 py-2">{fd(f.date)}</td>
                <td className="num whitespace-nowrap px-3 py-2">{f.isFstd ? "FSTD" : `${f.dep} → ${f.arr}`}{f.flightNumber ? <span className="text-muted"> · {f.flightNumber}</span> : null}</td>
                <td className="num whitespace-nowrap px-3 py-2">{f.out && f.in ? `${f.out.slice(11, 16)}–${f.in.slice(11, 16)} UTC` : "—"}</td>
                <td className="num whitespace-nowrap px-3 py-2">{[f.registration, f.type].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2">{f.function ?? "—"}</td>
                <td className="num px-3 py-2 text-right">{hm(f.totalMin || 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="px-3 py-2" colSpan={5}>{t("col.sum")}</td>
              <td className="num px-3 py-2 text-right">{hm(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><PenLine size={18} /> {t("signTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("name")}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("licence")}</span>
            <input className="input num" value={licence} onChange={(e) => setLicence(e.target.value)} />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-muted">{t("draw")}</p>
          <canvas
            ref={canvas}
            className="h-44 w-full touch-none rounded-lg border border-border bg-white"
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
              setInk(true);
            }}
            onPointerUp={() => (drawing.current = false)}
          />
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-muted underline"
            onClick={() => {
              const c = canvas.current!;
              c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
              setInk(false);
            }}
          >
            {t("clear")}
          </button>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t("attest", { n: data.flights.length, pilot: data.pilot })}</span>
        </label>
        {err ? <p className="text-sm text-warning">{err}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(t("refuseConfirm"))) return;
              if (await send({ action: "refuse" })) setDone("refused");
            }}
          >
            {t("refuse")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !ink || !checked || !name.trim()}
            onClick={async () => {
              const d = await send({ action: "sign", name: name.trim(), licence: licence.trim(), image: canvas.current!.toDataURL("image/png") });
              if (d) setDone({ signed: d.signed ?? 0, changed: d.changed ?? 0 });
            }}
          >
            <ShieldCheck size={16} /> {t("sign", { n: data.flights.length })}
          </button>
        </div>
      </section>
    </div>,
  );
}

function Notice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 text-xl font-semibold">{icon} {title}</div>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
