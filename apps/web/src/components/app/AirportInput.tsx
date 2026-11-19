"use client";

import { useId, useMemo, useState } from "react";
import type { Airport } from "@cielo/core";
import { useAirports } from "@/lib/airports";

/** ICAO input with search over ~19 000 aerodromes (ICAO, IATA, name, city). */
export function AirportInput({ value, onChange, label, required, big, align = "left" }: { value: string; onChange: (icao: string) => void; label: string; required?: boolean; big?: boolean; align?: "left" | "right" }) {
  const idx = useAirports();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const results = useMemo<Airport[]>(() => (idx && open && value.length >= 2 ? idx.search(value, 7) : []), [idx, open, value]);
  const known = idx?.get(value);

  const pick = (a: Airport) => {
    onChange(a.icao);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className={big ? `mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted ${align === "right" ? "text-right" : ""}` : "mb-1.5 block text-[13px] font-medium text-muted"}>
        {label}
      </label>
      <input
        id={id}
        className={big ? `airport-big num w-full bg-transparent font-bold uppercase tracking-[0.06em] outline-none placeholder:text-muted/40 ${align === "right" ? "text-right" : ""}` : "input num uppercase"}
        placeholder={big ? "ICAO" : undefined}
        value={value}
        required={required}
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={`${id}-list`}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
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
      <p className={`mt-1 h-4 truncate text-xs text-muted ${big && align === "right" ? "text-right" : ""}`}>{known ? `${known.name}${known.city ? ` · ${known.city}` : ""} · ${known.country}` : ""}</p>
      {results.length > 0 && !(results.length === 1 && results[0]!.icao === value) && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-[-14px] max-h-72 w-full min-w-64 overflow-auto rounded-lg border border-border bg-bg py-1 shadow-xl">
          {results.map((a, i) => (
            <li
              key={a.icao}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => (e.preventDefault(), pick(a))}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent/12" : ""}`}
            >
              <span className="num font-semibold">{a.icao}</span>
              {a.iata && <span className="num ml-1.5 text-xs text-muted">{a.iata}</span>}
              <span className="ml-2 text-muted">{a.name}</span>
              <span className="ml-1 text-xs text-muted">· {a.country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
