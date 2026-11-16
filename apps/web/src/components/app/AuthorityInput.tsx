"use client";

import { useId, useMemo, useState } from "react";
import { AUTHORITIES, searchAuthorities, type Authority } from "@cielo/core";

/** Licence authority with search (acronym, full name, country); any other text is kept as typed. */
export function AuthorityInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const results = useMemo<Authority[]>(() => (open ? searchAuthorities(value, 8) : []), [open, value]);
  const known = AUTHORITIES.find((a) => a.label === value);
  const pick = (a: Authority) => {
    onChange(a.label);
    setOpen(false);
  };
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-muted">{label}</label>
      <input
        id={id}
        className="input"
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={`${id}-list`}
        onChange={(e) => {
          onChange(e.target.value);
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
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      <p className="mt-1 h-4 truncate text-xs text-muted">{known ? `${known.name} · ${known.country}` : ""}</p>
      {results.length > 0 && !(results.length === 1 && results[0]!.label === value) && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-[-14px] max-h-72 w-full min-w-64 overflow-auto rounded-lg border border-border bg-bg py-1 shadow-xl">
          {results.map((a, i) => (
            <li
              key={a.label}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => (e.preventDefault(), pick(a))}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent/12" : ""}`}
            >
              <span className="font-semibold">{a.label}</span>
              <span className="ml-2 text-muted">{a.name}</span>
              <span className="ml-1 text-xs text-muted">· {a.country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
