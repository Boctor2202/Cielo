"use client";

import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { FlightForm } from "@/components/app/FlightForm";
import { FlightTrackCard } from "@/components/app/FlightTrackCard";
import { AircraftPhoto } from "@/components/app/AircraftPhoto";
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
      {!flight.isFstd && <AircraftPhoto registration={flight.registration} className="mb-6 max-w-sm" />}
      <FlightForm key={`${flight.id}-${flight.signatureId ?? ""}`} flight={flight} pilot={pilot} />
      <FlightTrackCard flight={flight} />
    </>
  );
}
