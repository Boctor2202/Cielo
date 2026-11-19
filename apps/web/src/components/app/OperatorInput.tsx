"use client";

import { BookMarked, Building2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { searchOperators } from "@cielo/core";
import { useAirlineDirectory } from "@/lib/airlines";

/**
 * Operator search: what is typed is matched against the operators of the logbook and the airline table (name,
 * ICAO or IATA code, letters in order). Free text stays allowed for an operator the table does not have.
 */
export function OperatorInput({
  value,
  onChange,
  known,
  placeholder,
  className = "",
  up,
  dark,
}: {
  value: string;
  onChange: (v: string) => void;
  known: string[];
  placeholder?: string;
  className?: string;
  /** the list opens above the field (a bar at the bottom of the screen) */
  up?: boolean;
  dark?: boolean;
}) {
  const t = useTranslations("app.operatorSearch");
  const id = useId();
  const directory = useAirlineDirectory();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useMemo(() => (open ? searchOperators(value, known, 8, directory) : []), [open, value, known, directory]);
  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };
  const exact = hits.length === 1 && hits[0]!.name === value;

  return (
    <div className="relative min-w-0 flex-1">
      <input
        id={id}
        className={`input ${className}`}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={`${id}-list`}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!hits.length) return;
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, hits.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          else if (e.key === "Enter" && open) (e.preventDefault(), pick(hits[active]!.name));
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {hits.length > 0 && !exact && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className={`absolute z-50 max-h-80 w-full min-w-72 overflow-auto rounded-xl border py-1 shadow-2xl ${up ? "bottom-full mb-2" : "mt-1"} ${dark ? "border-white/15 bg-[#0b1a33] text-white" : "border-border bg-bg"}`}
        >
          {hits.map((h, i) => (
            <li
              key={h.name}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => (e.preventDefault(), pick(h.name))}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm ${i === active ? (dark ? "bg-white/10" : "bg-accent/12") : ""}`}
            >
              {h.known ? <BookMarked size={14} className="shrink-0 text-accent" aria-label={t("known")} /> : <Building2 size={14} className="shrink-0 opacity-50" />}
              <span className="min-w-0 flex-1 truncate font-medium">{h.name}</span>
              {h.country && <span className="hidden shrink-0 text-[11px] opacity-50 sm:inline">{h.country}</span>}
              {h.icao && <span className="num shrink-0 rounded border border-current/20 px-1.5 text-[11px] opacity-60">{h.icao}{h.iata ? ` · ${h.iata}` : ""}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
