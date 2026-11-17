import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { atsReport, buildCvDocument, buildCvPdf, CV_THEMES, cvToText, flightExperience, toJsonResume, type CvData, type CvExperience, type CvFonts, type CvProfile, type CvTheme } from "@cielo/cv";
import { countryName } from "@cielo/core";
import { buildProfile, detectAircraft, matchJob, type Job } from "@cielo/jobs";
import { Button, Card, Chip, Field, Row, Screen, Segmented, ToggleRow, Txt } from "../../src/components/ui";
import { DateField } from "../../src/components/DateField";
import { Requires } from "../../src/components/Access";
import { api, API_URL } from "../../src/api";
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

      <TargetJob target={profile.target} onChange={(v) => set("target", v)} />

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
              <DateField month style={{ flex: 1 }} label={t("cv.start")} value={x.start} onChange={(v) => updExp(i, { start: v })} />
              <DateField month style={{ flex: 1 }} label={t("cv.end")} value={x.end ?? ""} onChange={(v) => updExp(i, { end: v || undefined })} hint={x.end ? undefined : t("cv.present")} />
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
                <DateField month style={{ flex: 1 }} label={t("cv.start")} value={x.start ?? ""} onChange={(v) => upd({ start: v })} />
                <DateField month style={{ flex: 1 }} label={t("cv.end")} value={x.end ?? ""} onChange={(v) => upd({ end: v })} />
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

/** Keywords an AI screener will look for in an offer: licence, aircraft names, hour categories (same rule as the web). */
function keywordsFor(job: Job): string[] {
  const k = new Set<string>();
  if (job.requirements.licence) k.add(job.requirements.licence === "FATPL" ? "ATPL" : job.requirements.licence);
  if (job.requirements.authority) k.add(job.requirements.authority);
  const name = job.title.replace(/\(.*?\)|first officer|captain|commandant|copilot|co-pilot|\bm\/[fw]\/d\b|[-–|/]/gi, " ").replace(/\s+/g, " ").trim();
  if (name.length > 2) k.add(name);
  if (job.requirements.jetHours) k.add("Jet");
  if (job.requirements.multiPilotHours) k.add("Multi-pilot");
  if (job.requirements.picHours) k.add("PIC");
  return [...k];
}

type Target = CvProfile["target"];

/**
 * The offer the CV is tailored to, picked from the same job feed as the Jobs tab (best matches first): its
 * types go first in the CV, its keywords join the CV's, and the check verifies they appear. Saved with the draft.
 */
function TargetJob({ target, onChange }: { target: Target; onChange: (v: Target) => void }) {
  const { t, flights, balances, licenses, aircraftTypes, pilot } = useApp();
  const c = useTheme();
  const [feed, setFeed] = useState<Job[] | null | undefined>(undefined);
  const [q, setQ] = useState("");
  useEffect(() => {
    api<{ jobs: Job[] }>("/api/jobs")
      .then((d) => setFeed(d.jobs ?? []))
      .catch(() => setFeed(null));
  }, []);

  const ranked = useMemo(() => {
    const engine = new Map(aircraftTypes.map((x) => [x.icao, x.engineType]));
    const me = buildProfile(flights, balances, licenses, (i) => engine.get(i), (code) => detectAircraft(code), { framework: pilot.regulatoryFramework });
    const list = (feed ?? []).map((job) => ({ job, score: me.totalMin > 0 ? matchJob(job, me).score : 0 }));
    return list.sort((a, b) => b.score - a.score || (b.job.postedAt ?? "").localeCompare(a.job.postedAt ?? "")).map((r) => r.job);
  }, [feed, flights, balances, licenses, aircraftTypes, pilot.regulatoryFramework]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? ranked.filter((j) => [j.company, j.title, j.location ?? "", ...j.aircraft].some((x) => x.toLowerCase().includes(s))) : ranked;
    return list.slice(0, 6);
  }, [ranked, q]);

  const pick = (job: Job) => {
    onChange({ title: job.title, company: job.company, aircraft: job.aircraft.slice(0, 3), keywords: keywordsFor(job) });
    setQ("");
  };
  const isTarget = (j: Job) => !!target && target.title === j.title && target.company === j.company;

  return (
    <Card>
      <Txt variant="h2">{t("cv.target")}</Txt>
      <Txt variant="small">{t("cv.targetHelp")}</Txt>
      <Row style={{ flexWrap: "wrap" }} gap={6}>
        <Chip label={t("cv.targetNone")} selected={!target} onPress={() => onChange(undefined)} />
        {target ? <Chip label={[target.company, target.title].filter(Boolean).join(" — ")} selected onPress={() => undefined} /> : null}
      </Row>
      {target?.aircraft?.length || target?.keywords?.length ? (
        <Txt variant="small" mono>{[...(target.aircraft ?? []), ...(target.keywords ?? [])].join(" · ")}</Txt>
      ) : null}
      {feed === undefined ? <ActivityIndicator color={c.accent} /> : null}
      {feed === null ? <Txt variant="small" color={c.warning}>{t("jobs.error")}</Txt> : null}
      {feed?.length ? (
        <>
          <Field placeholder={t("cv.targetSearch")} value={q} onChangeText={setQ} autoCorrect={false} />
          {shown.length === 0 ? <Txt variant="muted">{t("jobs.empty")}</Txt> : null}
          {shown.map((j) => (
            <Pressable key={j.id} accessibilityRole="button" onPress={() => pick(j)} style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <Row style={{ alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="small" style={{ fontWeight: "700" }}>{j.company}</Txt>
                  <Txt numberOfLines={2}>{j.title}</Txt>
                  {j.aircraft.length || j.location ? <Txt variant="small" numberOfLines={1}>{[j.aircraft.join(", "), j.location].filter(Boolean).join(" · ")}</Txt> : null}
                </View>
                {isTarget(j) ? <Ionicons name="checkmark-circle" size={20} color={c.accent} /> : null}
              </Row>
            </Pressable>
          ))}
        </>
      ) : null}
    </Card>
  );
}
