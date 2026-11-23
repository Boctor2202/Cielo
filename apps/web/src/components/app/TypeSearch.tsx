"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AircraftType } from "@cielo/core";

const fold = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * The aircraft type, searched by ICAO code, maker or model ("A320", "Airbus", "Citation"): the best few
 * matches float under the field (above the page, so a card's clipped edges never cut them).
 */
export function TypeSearch({ value, onChange, types, disabled }: { value: string; onChange: (icao: string) => void; types: AircraftType[] | undefined; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const hits = useMemo(() => {
    const q = fold(value.trim());
    if (!types?.length) return [];
    if (!q) return [];
    const words = q.split(/\s+/);
    return types
      .map((t) => {
        const hay = fold(`${t.icao} ${t.manufacturer} ${t.model}`);
        if (!words.every((w) => hay.includes(w))) return null;
        // the code itself first, then codes starting with it, then the rest
        const rank = t.icao === q ? 0 : t.icao.startsWith(q) ? 1 : fold(t.model).startsWith(q) ? 2 : 3;
        return { t, rank };
      })
      .filter((x): x is { t: AircraftType; rank: number } => !!x)
      .sort((a, b) => a.rank - b.rank || a.t.icao.localeCompare(b.t.icao))
      .slice(0, 8)
      .map((x) => x.t);
  }, [value, types]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = input.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
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
    const down = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!list.current?.contains(n) && !input.current?.contains(n)) setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open]);

  const pick = (t: AircraftType) => {
    onChange(t.icao);
    setOpen(false);
  };

  return (
    <>
      <input
        ref={input}
        className="input num uppercase"
        value={value}
        disabled={disabled}
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-autocomplete="list"
        placeholder="A320, Citation…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (!hits.length) return;
          if (e.key === "ArrowDown") (e.preventDefault(), setHi((h) => Math.min(hits.length - 1, h + 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setHi((h) => Math.max(0, h - 1)));
          else if (e.key === "Enter" && open) (e.preventDefault(), pick(hits[hi]!));
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && pos && hits.length > 0 && !(hits.length === 1 && hits[0]!.icao === value) &&
        createPortal(
          <ul ref={list} role="listbox" style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }} className="z-[60] max-h-72 overflow-y-auto rounded-xl border border-border bg-bg p-1 shadow-2xl">
            {hits.map((t, i) => (
              <li key={t.id} role="option" aria-selected={i === hi}>
                <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => pick(t)} onMouseEnter={() => setHi(i)} className={`flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left ${i === hi ? "bg-surface-2" : ""}`}>
                  <b className="num w-12 shrink-0 text-sm">{t.icao}</b>
                  <span className="truncate text-sm text-muted">{t.manufacturer} {t.model}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
