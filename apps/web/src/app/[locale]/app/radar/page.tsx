"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageTitle } from "@/components/app/ui";
import { RadarMap } from "@/components/app/RadarMap";
import { useFlights, usePilot } from "@/lib/hooks";
import { useAirports } from "@/lib/airports";
import { currentTheme } from "@/lib/theme";

export default function RadarPage() {
  const t = useTranslations("app.radar");
  const locale = useLocale();
  const flights = useFlights();
  const pilot = usePilot();
  const airports = useAirports();
  // where to start when the browser does not share the position: the home base, else Paris
  const base = pilot?.homeBaseIcao ? airports?.get(pilot.homeBaseIcao) : undefined;
  const fallback = base ? { lat: base.lat, lng: base.lon } : undefined;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(currentTheme() === "dark"), []);
  // the aircraft the pilot flew most recently, as one-tap shortcuts
  const myRegs = useMemo(() => {
    const seen: string[] = [];
    for (const f of flights ?? []) {
      const r = f.registration?.trim().toUpperCase();
      if (!f.isFstd && r && !seen.includes(r)) seen.push(r);
      if (seen.length >= 6) break;
    }
    return seen;
  }, [flights]);

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      {key && !failed ? <RadarMap apiKey={key} lang={locale} dark={dark} myRegs={myRegs} fallback={fallback} onError={() => setFailed(true)} /> : <p className="card p-6 text-sm text-muted">{t(key ? "keyRefused" : "needKey")}</p>}
    </>
  );
}
