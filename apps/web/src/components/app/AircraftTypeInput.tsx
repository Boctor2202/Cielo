"use client";

import { useId, useMemo, useState } from "react";
import type { AircraftType } from "@cielo/core";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Search over aircraft types (ICAO designator, manufacturer, model). */
export function searchTypes(types: AircraftType[], q: string, limit = 8): AircraftType[] {
  const s = norm(q.trim());
  if (!s) return [];
  const rank = (t: AircraftType) => {
    const icao = norm(t.icao);
    const name = norm(`${t.manufacturer} ${t.model}`);
    return icao === s ? 0 : icao.startsWith(s) ? 1 : norm(t.model).startsWith(s) ? 2 : name.includes(s) ? 3 : 9;
  };
  return types
    .filter((t) => !t.deletedAt)
    .map((t) => ({ t, r: rank(t) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || a.t.icao.localeCompare(b.t.icao))
    .slice(0, limit)
    .map((x) => x.t);
}

export function AircraftTypeInput({ types, value, onPick, label, hint }: { types: AircraftType[]; value: string; onPick: (t: AircraftType) => void; label: string; hint?: string }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const results = useMemo(() => (open ? searchTypes(types, q) : []), [types, q, open]);
  const known = types.find((t) => t.icao === value);
  const pick = (t: AircraftType) => {
    setQ(t.icao);
    setOpen(false);
    onPick(t);
  };
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-muted">{label}</label>
      <input
        id={id}
        className="input num uppercase"
        value={q}
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={`${id}-list`}
        placeholder="A320, Citation, PC-12…"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          else if (e.key === "Enter" && open) (e.preventDefault(), pick(results[active]!));
        }}
      />
      <p className="mt-1 h-4 truncate text-xs text-muted">{known ? `${known.manufacturer} ${known.model}` : hint ?? ""}</p>
      {results.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-[-14px] max-h-72 w-full min-w-64 overflow-auto rounded-lg border border-border bg-bg py-1 shadow-xl">
          {results.map((t, i) => (
            <li key={t.id} role="option" aria-selected={i === active} onMouseDown={(e) => (e.preventDefault(), pick(t))} className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent/12" : ""}`}>
              <span className="num font-semibold">{t.icao}</span>
              <span className="ml-2 text-muted">{t.manufacturer} {t.model}</span>
              {t.classOrTypeRating && <span className="num ml-1 text-xs text-muted">· {t.classOrTypeRating}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
