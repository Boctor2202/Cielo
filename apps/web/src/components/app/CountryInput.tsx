"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { countryName, searchCountries } from "@cielo/core";

/** Country (ISO code stored), searched by name in the user's language, English name or code. */
export function CountryInput({ value, onChange, label, hint }: { value: string | undefined; onChange: (code: string | undefined) => void; label: string; hint?: React.ReactNode }) {
  const locale = useLocale();
  const id = useId();
  const [q, setQ] = useState(value ? countryName(value, locale) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => setQ(value ? countryName(value, locale) : ""), [value, locale]);
  const results = useMemo(() => (open ? searchCountries(q, locale, 8) : []), [q, open, locale]);
  const pick = (code: string) => {
    onChange(code);
    setQ(countryName(code, locale));
    setOpen(false);
  };
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-muted">{label}</label>
      <input
        id={id}
        className="input"
        value={q}
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={`${id}-list`}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
          if (!e.target.value) onChange(undefined);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          else if (e.key === "Enter" && open) (e.preventDefault(), pick(results[active]!.code));
        }}
      />
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
      {results.length > 0 && !(results.length === 1 && results[0]!.code === value) && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-bg py-1 shadow-xl">
          {results.map((c, i) => (
            <li key={c.code} role="option" aria-selected={i === active} onMouseDown={(e) => (e.preventDefault(), pick(c.code))} className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent/12" : ""}`}>
              {c.name} <span className="num ml-1 text-xs text-muted">{c.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
