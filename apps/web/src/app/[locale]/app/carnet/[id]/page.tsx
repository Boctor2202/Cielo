"use client";

import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { FlightForm } from "@/components/app/FlightForm";
import { PageTitle } from "@/components/app/ui";
import { usePilot } from "@/lib/hooks";
import { db } from "@/lib/db";

export default function EditFlight() {
  const t = useTranslations("app.form");
  const { id } = useParams<{ id: string }>();
  const pilot = usePilot();
  const flight = useLiveQuery(() => db().t("flights").get(id), [id]);
  if (flight === undefined || !pilot) return <p className="text-muted">…</p>;
  return (
    <>
      <PageTitle title={t("editTitle")} subtitle={flight.isFstd ? `FSTD · ${flight.date}` : `${flight.depIcao} → ${flight.arrIcao} · ${flight.date}`} />
      <FlightForm key={`${flight.id}-${flight.signatureId ?? ""}`} flight={flight} pilot={pilot} />
    </>
  );
}
