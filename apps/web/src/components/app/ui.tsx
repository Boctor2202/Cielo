"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatDuration, parseDuration } from "@cielo/core";

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "", pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export type Level = "ok" | "info" | "caution" | "warning" | "neutral";
const LEVEL: Record<Level, string> = {
  ok: "text-success",
  info: "text-accent",
  caution: "text-caution",
  warning: "text-warning",
  neutral: "text-muted",
};
const LEVEL_BG: Record<Level, string> = {
  ok: "bg-success",
  info: "bg-accent",
  caution: "bg-caution",
  warning: "bg-warning",
  neutral: "bg-muted",
};

/** Instrument-style readout: label in small caps, big tabular figure, status bar. */
export function Readout({ label, value, sub, level = "info" }: { label: string; value: ReactNode; sub?: ReactNode; level?: Level }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <span className={`absolute inset-y-0 left-0 w-1 ${LEVEL_BG[level]}`} />
      <p className="label-caps">{label}</p>
      <p className="num mt-1.5 text-[26px] font-semibold leading-none tracking-tight sm:text-[30px]">{value}</p>
      {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Badge({ level = "neutral", children }: { level?: Level; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-current/25 px-1.5 py-0.5 text-xs font-semibold ${LEVEL[level]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_BG[level]}`} />
      {children}
    </span>
  );
}

export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-center gap-3 text-[15px] ${disabled ? "opacity-50" : ""}`}>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-10 rounded-full bg-surface-2 ring-1 ring-border transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      {label}
    </label>
  );
}

/** Duration input accepting 1:35, 1h35, 135, 1.6 — stores minutes. */
export function DurationInput({ value, onChange, placeholder = "0:00", className = "", disabled }: { value: number | undefined; onChange: (min: number | undefined) => void; placeholder?: string; className?: string; disabled?: boolean }) {
  const [text, setText] = useState(value !== undefined ? formatDuration(value) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value !== undefined ? formatDuration(value) : "");
  }, [value]);
  return (
    <input
      className={`input num ${className}`}
      inputMode="numeric"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const m = parseDuration(text);
        onChange(m ?? undefined);
        setText(m !== null ? formatDuration(m) : "");
      }}
    />
  );
}

/** HH:MM UTC clock input; accepts 0835, 8:35, 8h35. */
export function ClockInput({ value, onChange, className = "", ...rest }: { value?: string; onChange: (v: string | undefined) => void; className?: string; "aria-label"?: string; placeholder?: string }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  return (
    <input
      className={`input num text-center ${className}`}
      inputMode="numeric"
      maxLength={5}
      placeholder={rest.placeholder ?? "--:--"}
      aria-label={rest["aria-label"]}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const m = text.trim().match(/^(\d{1,2})\s*[:h.]?\s*(\d{2})$/);
        if (!text.trim()) return onChange(undefined);
        if (m && +m[1]! < 24 && +m[2]! < 60) {
          const v = `${m[1]!.padStart(2, "0")}:${m[2]}`;
          setText(v);
          onChange(v);
        } else setText(value ?? "");
      }}
    />
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0a1626]/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-bg shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm !px-1.5" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, text, action }: { icon?: ReactNode; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-muted/60">{icon}</div>}
      <p className="max-w-sm text-muted">{text}</p>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-surface p-0.5" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${o.value === value ? "bg-bg text-text shadow-sm ring-1 ring-border" : "text-muted hover:text-text"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Meter({ value, max, level }: { value: number; max: number; level?: Level }) {
  const pct = Math.min(100, (value / max) * 100);
  const l: Level = level ?? (value > max ? "warning" : value >= max * 0.9 ? "caution" : "ok");
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${LEVEL_BG[l]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-text px-4 py-2.5 text-sm font-medium text-bg shadow-lg lg:bottom-6">
      {msg}
    </div>
  ) : null;
  return { toast: setMsg, toastNode: node };
}
