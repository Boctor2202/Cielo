import React, { useEffect, useMemo, useState } from "react";
import { Alert, Share, View } from "react-native";
import { router } from "expo-router";
import { countryName } from "@cielo/core";
import { flightExperience, letterPilot, type CvData, type CvProfile } from "@cielo/cv";
import { Button, Card, Field, Screen, Segmented, Txt, tap } from "../src/components/ui";
import { Paywall } from "../src/components/Access";
import { API_URL } from "../src/api";
import { getLetterJob } from "../src/letterJob";
import { todayUtc, useApp } from "../src/state";
import { space, useTheme } from "../src/theme";

const EMPTY: CvProfile = { fullName: "", experience: [], education: [], languages: [], skills: [] };

/**
 * Cover-letter assistant: writes a letter for one offer from the pilot's logbook, licences and CV draft,
 * worded so recruiters' screening tools pick up the offer's keywords. The pilot reviews and edits it.
 */
export default function Letter() {
  const { t, store, pilot, flights, balances, licenses, aircraftTypes, session, access, locale: uiLocale } = useApp();
  const c = useTheme();
  const job = useMemo(() => getLetterJob(), []);
  const [locale, setLocale] = useState<"fr" | "en">(uiLocale === "fr" ? "fr" : "en");
  const [adText, setAdText] = useState("");
  const [notes, setNotes] = useState("");
  const [letter, setLetter] = useState("");
  const [busy, setBusy] = useState(false);
  const [cv, setCv] = useState<CvProfile | null>(null);

  useEffect(() => {
    void store.getMeta("cv").then((raw) => setCv({ ...EMPTY, fullName: pilot.fullName, ...(raw ? (JSON.parse(raw) as CvProfile) : {}) }));
  }, [store, pilot.fullName]);

  const data: CvData | null = useMemo(() => {
    if (!cv) return null;
    const byIcao = new Map(aircraftTypes.map((x) => [x.icao, x]));
    return {
      profile: { ...cv, fullName: cv.fullName || pilot.fullName, nationality: cv.nationality || (pilot.nationality ? countryName(pilot.nationality, locale) : undefined) },
      hours: flightExperience(flights, balances, (i) => byIcao.get(i), todayUtc()),
      licences: licenses.filter((l) => !l.deletedAt).map((l) => ({ kind: l.kind, code: l.code, authority: l.authority, number: l.number, validUntil: l.validUntil, issuedOn: l.issuedOn })),
      locale,
    };
  }, [cv, flights, balances, licenses, aircraftTypes, locale, pilot]);

  if (!access.has("cv")) return <Paywall feature="cv" />;

  const write = async () => {
    if (!data) return;
    if (!session) return Alert.alert(t("letter.signIn"));
    if (!job && adText.trim().length < 80) return Alert.alert(t("letter.needAd"));
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          locale,
          job: job
            ? { company: job.company, title: job.title, location: job.location, aircraft: job.aircraft, requirements: job.requirements, url: job.url, text: adText.trim() || undefined }
            : { text: adText.trim() },
          pilot: letterPilot(data, { rank: pilot.rank, employer: pilot.employer, base: pilot.homeBaseIcao }),
          notes: notes.trim() || undefined,
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { letter?: string; error?: string };
      if (!r.ok || !d.letter) throw new Error(t(`letter.err.${d.error === "plan" || d.error === "rate_limited" || d.error === "not_configured" ? d.error : "other"}` as never));
      setLetter(d.letter);
      tap("success");
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        {job ? (
          <View style={{ gap: 2 }}>
            <Txt variant="small" style={{ fontWeight: "700" }}>{job.company}</Txt>
            <Txt style={{ fontWeight: "600" }}>{job.title}</Txt>
            <Txt variant="small">{[job.location, job.aircraft.join(", ")].filter(Boolean).join(" · ")}</Txt>
          </View>
        ) : (
          <Txt variant="small">{t("letter.noJob")}</Txt>
        )}
        <Field
          label={job ? t("letter.adOptional") : t("letter.ad")}
          value={adText}
          onChangeText={setAdText}
          multiline
          placeholder={t("letter.adPh")}
          style={{ minHeight: job ? 80 : 160 }}
        />
        <Field label={t("letter.notes")} value={notes} onChangeText={setNotes} multiline placeholder={t("letter.notesPh")} />
        <Segmented<"fr" | "en"> value={locale} onChange={setLocale} options={[{ value: "fr", label: "Français" }, { value: "en", label: "English" }]} />
        <Button title={letter ? t("letter.again") : t("letter.write")} loading={busy} onPress={() => void write()} />
        <Txt variant="small" color={c.muted}>{t("letter.atsNote")}</Txt>
      </Card>

      {letter ? (
        <Card>
          <Txt variant="h2">{t("letter.result")}</Txt>
          <Field value={letter} onChangeText={setLetter} multiline style={{ minHeight: 320 }} />
          <Txt variant="small" color={c.caution}>{t("letter.check")}</Txt>
          {/* the share sheet also offers "Copy" */}
          <Button kind="secondary" title={t("letter.share")} onPress={() => void Share.share({ message: letter })} />
          {job ? <Button kind="ghost" title={t("letter.openOffer")} onPress={() => router.back()} /> : null}
        </Card>
      ) : null}
      <View style={{ height: space.md }} />
    </Screen>
  );
}
