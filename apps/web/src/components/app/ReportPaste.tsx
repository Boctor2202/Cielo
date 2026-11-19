"use client";

import { ClipboardPaste } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { parseFlightReport, type FlightReport } from "@cielo/core";
import { Modal } from "./ui";

/**
 * "Paste a flight report": the e-mail or summary an airline sends after each flight (Ryanair and others, in
 * "Field : value" form). The fields found are shown before they fill the form.
 */
export function ReportPaste({ onApply }: { onApply: (r: FlightReport) => void }) {
  const t = useTranslations("app.form.report");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const r = text.trim() ? parseFlightReport(text) : undefined;
  const rows: [string, string | undefined][] = r
    ? [
        [t("f.date"), r.date],
        [t("f.flightNumber"), r.flightNumber],
        [t("f.registration"), r.registration],
        [t("f.route"), r.from || r.to ? `${r.from ?? "?"} → ${r.to ?? "?"}` : undefined],
        ["OUT / OFF / ON / IN", [r.out, r.off, r.on, r.in].some(Boolean) ? [r.out, r.off, r.on, r.in].map((x) => x ?? "—").join(" · ") : undefined],
        [t("f.takeoff"), r.takeoffBy],
        [t("f.landing"), r.landingBy],
      ]
    : [];
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm text-accent" onClick={() => setOpen(true)}>
        <ClipboardPaste size={15} /> {t("button")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("title")}>
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("hint")}</p>
          <textarea className="input num min-h-48 text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"FlightNumber : FR1234\nRegistration : EIABC\nCity Pair : BVA - OPO\nOff Block : 04:51\n…"} />
          {text.trim() && !r && <p className="text-sm text-[var(--warning)]">{t("notFound")}</p>}
          {r && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border p-3 text-sm">
              {rows.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-xs text-muted">{t("utc")}</p>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!r}
            onClick={() => {
              onApply(r!);
              setOpen(false);
              setText("");
            }}
          >
            {t("apply")}
          </button>
        </div>
      </Modal>
    </>
  );
}
