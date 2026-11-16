import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { atsReport, buildCvDocument, buildCvPdf, CV_THEMES, cvToText, flightExperience, toJsonResume, type CvData, type CvExperience, type CvFonts, type CvProfile, type CvTheme } from "@cielo/cv";
import { countryName } from "@cielo/core";
import { Button, Card, Chip, Field, Row, Screen, Segmented, ToggleRow, Txt } from "../../src/components/ui";
import { Requires } from "../../src/components/Access";
import { API_URL } from "../../src/api";
import { shareFile } from "../../src/exporters";
import { todayUtc, useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

const EMPTY: CvProfile = { fullName: "", experience: [], education: [], languages: [], skills: [] };

let fonts: Promise<CvFonts | undefined> | null = null;
/** The CV font (Inter), downloaded once from the website; without it the PDF uses Helvetica. */
const loadFonts = () =>
  (fonts ??= Promise.all([400, 600, 700].map((w) => fetch(`${API_URL}/fonts/cv/Inter-${w}.ttf`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => new Uint8Array(b))))
    .then(([regular, semibold, bold]): CvFonts => ({ regular: regular!, semibold: semibold!, bold: bold! }))
    .catch(() => {
      fonts = null;
      return undefined;
    }));

/** JPEG or PNG bytes of a data URL (the profile photo comes from the website). */
function photoBytes(url?: string): Uint8Array | undefined {
  const m = url?.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
  if (!m) return undefined;
  const bin = atob(m[2]!);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function CvScreen() {
  return (
    <Requires feature="cv">
      <Cv />
    </Requires>
  );
}

function Cv() {
  const { t, store, pilot, flights, balances, licenses, aircraftTypes, locale: uiLocale } = useApp();
  const c = useTheme();
  const [profile, setProfile] = useState<CvProfile | null>(null);
  const [locale, setLocale] = useState<"en" | "fr">("en");
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  // the CV draft lives on this phone, next to the logbook
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void store.getMeta("cv").then((raw) => {
      const saved = raw ? (JSON.parse(raw) as CvProfile) : null;
      // what the profile already knows fills the empty CV fields
      const known = { fullName: pilot.fullName, email: pilot.email || undefined, phone: pilot.phone || undefined, nationality: pilot.nationality ? countryName(pilot.nationality, uiLocale) : undefined };
      const merged = { ...EMPTY, ...known, ...saved };
      for (const k of Object.keys(known) as (keyof typeof known)[]) if (!merged[k]) merged[k] = known[k] as never;
      setProfile(merged);
    });
  }, [store, pilot]);
  useEffect(() => {
    if (profile) void store.setMeta("cv", JSON.stringify(profile));
  }, [profile, store]);
  const set = <K extends keyof CvProfile>(k: K, v: CvProfile[K]) => setProfile((p) => (p ? { ...p, [k]: v } : p));

  const data: CvData | null = useMemo(() => {
    if (!profile) return null;
    const byIcao = new Map(aircraftTypes.map((x) => [x.icao, x]));
    const hours = flightExperience(flights, balances, (i) => byIcao.get(i), todayUtc());
    return { profile, hours, locale, licences: licenses.filter((l) => !l.deletedAt).map((l) => ({ kind: l.kind, code: l.code, authority: l.authority, number: l.number, validUntil: l.validUntil, issuedOn: l.issuedOn })) };
  }, [profile, flights, balances, licenses, aircraftTypes, locale]);
  const doc = useMemo(() => (data ? buildCvDocument(data) : null), [data]);
  const report = useMemo(() => (data && doc ? atsReport(data, doc, cvToText(doc), todayUtc()) : null), [data, doc]);
  if (!profile || !data || !doc || !report) return <Screen><Txt variant="muted">…</Txt></Screen>;

  const share = async () => {
    setBusy(true);
    try {
      const opts = { jsonResume: toJsonResume(data), lang: locale, author: profile.fullName, theme: profile.theme, photo: profile.photo ? photoBytes(pilot.photoDataUrl) : undefined };
      let bytes: Uint8Array;
      try {
        bytes = await buildCvPdf(doc, { ...opts, fonts: await loadFonts() });
      } catch {
        // the embedded font failed: the standard font still gives a complete CV
        bytes = await buildCvPdf(doc, opts);
      }
      const slug = (profile.fullName || "pilot").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
      await shareFile(`cv-${slug}-${locale}.pdf`, bytes, "application/pdf", "com.adobe.pdf");
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const updExp = (i: number, patch: Partial<CvExperience>) => set("experience", profile.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const scoreColor = report.score >= 85 ? c.success : report.score >= 65 ? c.accent : c.caution;
  const issues = report.checks.filter((x) => x.status !== "ok");

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Segmented<"en" | "fr"> value={locale} onChange={setLocale} options={[{ value: "en", label: "English" }, { value: "fr", label: "Français" }]} />
        </Row>
        <Button title={t("cv.share")} loading={busy} onPress={() => void share()} />
        <Txt variant="small">{t("cv.shareHint")}</Txt>
      </Card>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt variant="h2">{t("cv.ats")}</Txt>
          <Txt mono style={{ fontSize: 22, fontWeight: "800" }} color={scoreColor}>{report.score}%</Txt>
        </Row>
        {issues.length === 0 ? <Txt variant="muted">{t("cv.atsOk")}</Txt> : null}
        {issues.map((x) => (
          <Txt key={x.code} variant="small" color={x.status === "warn" ? c.caution : c.warning}>• {t(`cv.check.${x.code}` as never, { detail: x.detail ?? "" })}</Txt>
        ))}
      </Card>

      <Card>
        <Txt variant="h2">{t("cv.look")}</Txt>
        <Row style={{ flexWrap: "wrap" }} gap={6}>
          {(Object.keys(CV_THEMES) as CvTheme[]).map((k) => (
            <Pressable key={k} onPress={() => set("theme", k)}>
              <Row gap={6} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: (profile.theme ?? "navy") === k ? c.accent : c.border }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: CV_THEMES[k].swatch, borderWidth: 2, borderColor: CV_THEMES[k].accent }} />
                <Txt variant="small" color={c.text}>{t(`cv.theme.${k}` as never)}</Txt>
              </Row>
            </Pressable>
          ))}
        </Row>
        <ToggleRow label={t("cv.photo")} value={!!profile.photo && !!photoBytes(pilot.photoDataUrl)} onChange={(v) => set("photo", v)} hint={photoBytes(pilot.photoDataUrl) ? undefined : t("cv.noPhoto")} />
      </Card>

      <Card>
        <Txt variant="h2">{t("cv.identity")}</Txt>
        <Field label={t("more.fullName")} value={profile.fullName} onChangeText={(v) => set("fullName", v)} autoCapitalize="words" />
        <Field label={t("cv.headline")} value={profile.headline ?? ""} onChangeText={(v) => set("headline", v)} placeholder="First Officer · Citation Latitude" />
        <Field label={t("cv.email")} value={profile.email ?? ""} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" />
        <Field label={t("profile.phone")} value={profile.phone ?? ""} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
        <Field label={t("cv.location")} value={profile.location ?? ""} onChangeText={(v) => set("location", v)} />
        <Field label={t("profile.nationality")} value={profile.nationality ?? ""} onChangeText={(v) => set("nationality", v)} />
        <Field label={t("cv.rightToWork")} value={profile.rightToWork ?? ""} onChangeText={(v) => set("rightToWork", v)} placeholder={t("cv.rightToWorkPh")} />
        <Field label="LinkedIn" value={profile.linkedin ?? ""} onChangeText={(v) => set("linkedin", v)} autoCapitalize="none" />
      </Card>

      <Card>
        <Txt variant="h2">{t("cv.summary")}</Txt>
        <Field value={profile.summary ?? ""} onChangeText={(v) => set("summary", v)} multiline placeholder={t("cv.summaryPh")} />
      </Card>

      <Card>
        <Txt variant="h2">{t("cv.experience")}</Txt>
        {profile.experience.map((x, i) => (
          <View key={i} style={{ gap: 6, borderTopWidth: i ? 1 : 0, borderColor: c.border, paddingTop: i ? 10 : 0 }}>
            <Field label={t("cv.role")} value={x.role} onChangeText={(v) => updExp(i, { role: v })} />
            <Field label={t("profile.employer")} value={x.employer} onChangeText={(v) => updExp(i, { employer: v })} />
            <Row>
              <Field style={{ flex: 1 }} label={t("cv.start")} value={x.start} onChangeText={(v) => updExp(i, { start: v })} placeholder="2021-03" monoValue />
              <Field style={{ flex: 1 }} label={t("cv.end")} value={x.end ?? ""} onChangeText={(v) => updExp(i, { end: v || undefined })} placeholder={t("cv.present")} monoValue />
            </Row>
            <Field label={t("cv.aircraft")} value={(x.aircraft ?? []).join(", ")} onChangeText={(v) => updExp(i, { aircraft: v.toUpperCase().split(/[,\s]+/).filter(Boolean) })} autoCapitalize="characters" monoValue />
            <Field label={t("cv.bullets")} value={x.bullets.join("\n")} onChangeText={(v) => updExp(i, { bullets: v.split("\n") })} multiline />
            <Button kind="ghost" small title={t("common.delete")} onPress={() => set("experience", profile.experience.filter((_, j) => j !== i))} />
          </View>
        ))}
        <Button kind="secondary" small title={t("common.add")} onPress={() => set("experience", [...profile.experience, { role: "", employer: "", start: "", bullets: [] }])} />
      </Card>

      <Card>
        <Txt variant="h2">{t("cv.education")}</Txt>
        {profile.education.map((x, i) => {
          const upd = (patch: Partial<typeof x>) => set("education", profile.education.map((e, j) => (j === i ? { ...e, ...patch } : e)));
          return (
            <View key={i} style={{ gap: 6 }}>
              <Field label={t("cv.titleEdu")} value={x.title} onChangeText={(v) => upd({ title: v })} />
              <Field label={t("cv.school")} value={x.school} onChangeText={(v) => upd({ school: v })} />
              <Row>
                <Field style={{ flex: 1 }} label={t("cv.start")} value={x.start ?? ""} onChangeText={(v) => upd({ start: v })} placeholder="2014-09" monoValue />
                <Field style={{ flex: 1 }} label={t("cv.end")} value={x.end ?? ""} onChangeText={(v) => upd({ end: v })} placeholder="2016-06" monoValue />
              </Row>
              <Button kind="ghost" small title={t("common.delete")} onPress={() => set("education", profile.education.filter((_, j) => j !== i))} />
            </View>
          );
        })}
        <Button kind="secondary" small title={t("common.add")} onPress={() => set("education", [...profile.education, { title: "", school: "" }])} />
      </Card>

      <Card>
        <Txt variant="h2">{t("cv.languages")}</Txt>
        {profile.languages.map((x, i) => {
          const upd = (patch: Partial<typeof x>) => set("languages", profile.languages.map((e, j) => (j === i ? { ...e, ...patch } : e)));
          return (
            <View key={i} style={{ gap: 6 }}>
              <Row>
                <Field style={{ flex: 1 }} label={t("cv.language")} value={x.name} onChangeText={(v) => upd({ name: v })} />

              </Row>
              {!x.name ? (
                <Row style={{ flexWrap: "wrap" }} gap={6}>
                  {t("cv.langs").split("|").map((l) => (
                    <Chip key={l} label={l} onPress={() => upd({ name: l })} />
                  ))}
                </Row>
              ) : null}
              <Txt variant="small">{t("cv.level")}</Txt>
              <Row style={{ flexWrap: "wrap" }} gap={6}>
                {t("cv.levels").split("|").map((l) => (
                  <Chip key={l} label={l} selected={x.level === l} onPress={() => upd({ level: x.level === l ? undefined : l })} />
                ))}
              </Row>
              <Row gap={6}>
                <Txt variant="small">{t("cv.icao")}</Txt>
                {[4, 5, 6].map((n) => (
                  <Chip key={n} label={String(n)} selected={x.icaoLevel === n} onPress={() => upd({ icaoLevel: x.icaoLevel === n ? undefined : n })} />
                ))}
                <View style={{ flex: 1 }} />
                <Button kind="ghost" small title={t("common.delete")} onPress={() => set("languages", profile.languages.filter((_, j) => j !== i))} />
              </Row>
            </View>
          );
        })}
        <Button kind="secondary" small title={t("common.add")} onPress={() => set("languages", [...profile.languages, { name: "" }])} />
      </Card>

      <Card>
        <Txt variant="h2">{t("cv.skills")}</Txt>
        <Field value={profile.skills.join(", ")} onChangeText={(v) => set("skills", v.split(",").map((s) => s.trimStart()))} placeholder="CRM, EFB, …" />
      </Card>
      <Txt variant="small">{t("cv.note")}</Txt>
    </Screen>
  );
}
