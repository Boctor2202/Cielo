"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { hours8710, report8710, ROWS_8710, type Cells8710 } from "@cielo/core";
import { Card, PageTitle } from "@/components/app/ui";
import { DateInput } from "@/components/app/DateInput";
import { useFlights, useTypes } from "@/lib/hooks";

/** Columns of FAA Form 8710-1, III. Record of Pilot Time, in order; "PIC / SIC" cells show both. */
const COLS: { key: string; cells: (c: Cells8710) => string }[] = [
  { key: "total", cells: (c) => hours8710(c.total) },
  { key: "instruction", cells: (c) => hours8710(c.instructionReceived) },
  { key: "solo", cells: (c) => hours8710(c.solo) },
  { key: "picSic", cells: (c) => pair(hours8710(c.pic), hours8710(c.sic)) },
  { key: "xcInstruction", cells: (c) => hours8710(c.xcInstruction) },
  { key: "xcSolo", cells: (c) => hours8710(c.xcSolo) },
  { key: "xcPicSic", cells: (c) => pair(hours8710(c.xcPic), hours8710(c.xcSic)) },
  { key: "instrument", cells: (c) => hours8710(c.instrument) },
  { key: "nightInstruction", cells: (c) => hours8710(c.nightInstruction) },
  { key: "nightToLdg", cells: (c) => (c.nightToLdg ? String(c.nightToLdg) : "") },
  { key: "nightPicSic", cells: (c) => pair(hours8710(c.nightPic), hours8710(c.nightSic)) },
  { key: "nightToLdgPicSic", cells: (c) => pair(c.nightToLdgPic ? String(c.nightToLdgPic) : "", c.nightToLdgSic ? String(c.nightToLdgSic) : "") },
  { key: "flights", cells: (c) => (c.flights ? String(c.flights) : "") },
  { key: "aeroTows", cells: () => "" },
  { key: "groundLaunches", cells: () => "" },
  { key: "poweredLaunches", cells: () => "" },
];
function pair(a: string, b: string) {
  return a || b ? `${a || "0"} / ${b || "0"}` : "";
}

/**
 * FAA Form 8710-1, III. Record of Pilot Time, worked out from the logbook: what to copy into IACRA (or onto the
 * paper form), printable. A period can be chosen; the whole logbook by default.
 */
export default function Report8710Page() {
  const t = useTranslations("app.r8710");
  const flights = useFlights();
  const types = useTypes();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const r = useMemo(() => {
    if (!flights || !types) return null;
    return report8710(flights.filter((f) => (!from || f.date >= from) && (!to || f.date <= to)), types);
  }, [flights, types, from, to]);

  return (
    <>
      <PageTitle
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={15} /> {t("print")}</button>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm"><span className="mb-1 block text-xs text-muted">{t("from")}</span><DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-xs text-muted">{t("to")}</span><DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <Card pad={false} className="print-area">
        <div className="overflow-x-auto p-4">
          <p className="mb-3 hidden text-sm font-semibold print:block">{t("title")}</p>
          <table className="num w-full min-w-[1100px] text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-[10.5px] text-muted">
                <th className="py-2 pr-3 text-left font-semibold" />
                {COLS.map((c) => <th key={c.key} className="px-1.5 py-2 text-right align-bottom font-semibold leading-tight">{t(`col.${c.key}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {r &&
                ROWS_8710.map((row) => {
                  const c = r.rows[row];
                  return [
                    <tr key={row} className="border-b border-border/60">
                      <td className="whitespace-nowrap py-2 pr-3 text-left font-semibold">{t(`row.${row}`)}</td>
                      {COLS.map((col) => <td key={col.key} className="whitespace-nowrap px-1.5 py-2 text-right">{col.cells(c)}</td>)}
                    </tr>,
                    ...(row === "airplanes"
                      ? r.classes.map((k) => (
                          <tr key={k.cls} className="border-b border-border/40 text-muted">
                            <td className="whitespace-nowrap py-1.5 pl-4 pr-3 text-left text-xs">{t("classRow", { cls: k.cls })}</td>
                            <td className="px-1.5 py-1.5 text-right text-xs">{hours8710(k.total)}</td>
                            <td colSpan={2} />
                            <td className="whitespace-nowrap px-1.5 py-1.5 text-right text-xs">{pair(hours8710(k.pic), hours8710(k.sic))}</td>
                            <td colSpan={COLS.length - 4} />
                          </tr>
                        ))
                      : []),
                  ];
                })}
            </tbody>
          </table>
        </div>
      </Card>
      <ul className="mt-4 max-w-4xl list-disc space-y-1 pl-5 text-xs text-muted">
        <li>{t("noteHours")}</li>
        <li>{t("notePicus")}</li>
        <li>{t("noteLaunches")}</li>
        {r && r.unknown > 0 && <li className="text-warning">{t("noteUnknown", { n: r.unknown })}</li>}
        <li>{t("noteCheck")}</li>
      </ul>
    </>
  );
}
