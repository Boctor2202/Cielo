"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FlightFormInput } from "@cielo/core";
import { FlightForm } from "@/components/app/FlightForm";
import { PageTitle } from "@/components/app/ui";
import { usePilot } from "@/lib/hooks";
import { db } from "@/lib/db";
import { flightToInput } from "@/lib/repo";

function NewFlight() {
  const t = useTranslations("app.form");
  const pilot = usePilot();
  const q = useSearchParams();
  const [prefill, setPrefill] = useState<Partial<FlightFormInput> | null | undefined>(undefined);
  const rosterId = q.get("roster");

  useEffect(() => {
    (async () => {
      const from = q.get("from");
      if (from) {
        const f = await db().t("flights").get(from);
        if (f) {
          const base = flightToInput(f);
          const reset = { out: undefined, off: undefined, on: undefined, in: undefined, nightOverrideMin: undefined, autoLandings: true };
          if (q.get("mode") === "return") setPrefill({ ...base, ...reset, depIcao: f.arrIcao, arrIcao: f.depIcao, flightNumber: undefined, pilotFlying: !f.pilotFlying, remarks: undefined });
          else setPrefill({ ...base, ...reset });
          return;
        }
      }
      if (rosterId) {
        const ev = await db().t("roster_events").get(rosterId);
        if (ev) {
          setPrefill({
            date: ev.startUtc.slice(0, 10),
            flightNumber: ev.flightNumber,
            depIcao: ev.depIcao ?? "",
            arrIcao: ev.arrIcao ?? "",
            out: ev.startUtc.slice(11, 16),
            in: ev.endUtc.slice(11, 16),
            registration: ev.aircraftReg,
            aircraftTypeIcao: ev.aircraftTypeIcao,
            isFstd: ev.kind === "SIM",
            fstdMin: ev.kind === "SIM" ? Math.round((Date.parse(ev.endUtc) - Date.parse(ev.startUtc)) / 60000) : undefined,
          });
          return;
        }
      }
      setPrefill(null);
    })();
  }, [q, rosterId]);

  if (prefill === undefined || !pilot) return <p className="text-muted">…</p>;
  return (
    <>
      <PageTitle title={t("newTitle")} />
      <FlightForm key={q.toString()} pilot={pilot} prefill={prefill ?? undefined} source={rosterId ? "roster" : undefined} rosterEventId={rosterId ?? undefined} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewFlight />
    </Suspense>
  );
}
