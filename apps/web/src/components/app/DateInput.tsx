"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A date field in the European order, the same in every browser: typed as digits (day, month, year, the
 * slashes come by themselves) or picked on a calendar with its month and year lists. The value stays
 * YYYY-MM-DD, as the native date input gave it: `onChange` receives `{ target: { value } }` once the date is
 * complete and real, or "" when emptied, so it replaces `<input type="date">` as it is.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const real = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};
/** "17112026" → "17/11/2026" */
export function typedDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
const toIso = (text: string) => {
  const d = text.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}` : "";
};
const toText = (iso: string) => (real(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const todayIso = () => {
  const n = new Date();
  return isoOf(n.getFullYear(), n.getMonth(), n.getDate());
};

type Props = {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

export function DateInput({ value, onChange, min, max, required, disabled, className = "input num", id, "aria-label": ariaLabel }: Props) {
  const locale = useLocale();
  const [text, setText] = useState(() => toText(value));
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const fr = locale === "fr";

  // a value set from outside (a reset, another field) shows in the field
  useEffect(() => {
    if (toIso(text) !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const out = (iso: string) => (min && iso < min) || (max && iso > max);
  const commit = (iso: string) => {
    setText(toText(iso));
    onChange({ target: { value: iso } });
  };

  const type = (raw: string) => {
    // backspace on a slash takes the digit before it
    const digits = (x: string) => x.replace(/\D/g, "");
    const erased = raw.length < text.length && digits(raw) === digits(text);
    const next = typedDate(erased ? digits(raw).slice(0, -1) : raw);
    setText(next);
    if (!next) return onChange({ target: { value: "" } });
    const iso = toIso(next);
    if (iso && real(iso) && !out(iso)) onChange({ target: { value: iso } });
  };
  // left incomplete or impossible: back to the last good date
  const blur = () => {
    const iso = toIso(text);
    if (!text) return;
    if (!iso || !real(iso) || out(iso)) setText(toText(value));
  };

  /* ---------- the calendar ---------- */
  const start = real(value) ? value : min && todayIso() < min ? min : max && todayIso() > max ? max : todayIso();
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const show = () => {
    if (disabled) return;
    const s = real(value) ? value : start;
    setView({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) - 1 });
    setOpen(true);
  };
  // placed under the field (above when there is no room), outside any scrolling box
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      const h = 340;
      const up = r.bottom + h > window.innerHeight && r.top > h;
      setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 296)), top: up ? r.top - 6 : r.bottom + 6, up });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(Date.UTC(2026, i, 15))), [locale]);
  // weeks start on Monday, as in Europe
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(Date.UTC(2026, 10, 16 + i))), [locale]);
  const minY = min ? Number(min.slice(0, 4)) : 1950;
  const maxY = max ? Number(max.slice(0, 4)) : 2100;
  const years = useMemo(() => Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i), [minY, maxY]);
  const first = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const move = (n: number) => setView((v) => {
    const d = new Date(Date.UTC(v.y, v.m + n, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });
  const today = todayIso();

  return (
    <div ref={wrap} className="relative">
      <input
        id={id}
        aria-label={ariaLabel}
        className={`${className} pr-9`}
        inputMode="numeric"
        autoComplete="off"
        placeholder={fr ? "JJ/MM/AAAA" : "DD/MM/YYYY"}
        maxLength={10}
        required={required}
        disabled={disabled}
        value={text}
        onChange={(e) => type(e.target.value)}
        onBlur={blur}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={fr ? "Choisir dans le calendrier" : "Pick on the calendar"}
        onClick={() => (open ? setOpen(false) : show())}
        className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-[color:var(--text)]/10 hover:text-[color:var(--accent)]"
      >
        <CalendarDays size={16} />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={pop}
              role="dialog"
              aria-label={fr ? "Calendrier" : "Calendar"}
              className="fixed z-[1000] w-[288px] rounded-xl border border-border bg-surface p-3 text-sm text-[color:var(--text)] shadow-2xl"
              style={{ left: pos.left, top: pos.top, transform: pos.up ? "translateY(-100%)" : undefined, background: "var(--surface, var(--bg))" }}
            >
              <div className="flex items-center gap-1">
                <button type="button" className="grid h-8 w-8 place-items-center rounded-md hover:bg-[color:var(--text)]/10" onClick={() => move(-1)} aria-label={fr ? "Mois précédent" : "Previous month"}><ChevronLeft size={16} /></button>
                <select className="input !h-8 !w-auto flex-1 !px-2 !py-0 text-sm capitalize" value={view.m} onChange={(e) => setView({ ...view, m: Number(e.target.value) })} aria-label={fr ? "Mois" : "Month"}>
                  {months.map((n, i) => <option key={i} value={i}>{n}</option>)}
                </select>
                <select className="input num !h-8 !w-auto !px-2 !py-0 text-sm" value={view.y} onChange={(e) => setView({ ...view, y: Number(e.target.value) })} aria-label={fr ? "Année" : "Year"}>
                  {!years.includes(view.y) && <option value={view.y}>{view.y}</option>}
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-md hover:bg-[color:var(--text)]/10" onClick={() => move(1)} aria-label={fr ? "Mois suivant" : "Next month"}><ChevronRight size={16} /></button>
              </div>
              <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-muted">
                {days.map((d, i) => <span key={i} className="py-1">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) => {
                  if (!d) return <span key={i} />;
                  const iso = isoOf(view.y, view.m, d);
                  const on = iso === value;
                  const off = !!out(iso);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={off}
                      onClick={() => (commit(iso), setOpen(false))}
                      className={`num h-9 rounded-md text-sm transition-colors ${on ? "bg-[color:var(--accent)] font-bold text-[#0a1626]" : iso === today ? "font-bold text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/50" : "hover:bg-[color:var(--text)]/10"} ${off ? "opacity-30" : ""}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs font-semibold">
                <button type="button" className="rounded px-2 py-1 text-[color:var(--accent)] hover:bg-[color:var(--text)]/10 disabled:opacity-40" disabled={!!out(today)} onClick={() => (commit(today), setOpen(false))}>{fr ? "Aujourd'hui" : "Today"}</button>
                {!required && <button type="button" className="rounded px-2 py-1 text-muted hover:bg-[color:var(--text)]/10" onClick={() => (setText(""), onChange({ target: { value: "" } }), setOpen(false))}>{fr ? "Effacer" : "Clear"}</button>}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
