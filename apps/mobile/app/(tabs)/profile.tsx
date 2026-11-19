import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { formatPhoneIntl, AUTHORITIES, RANKS, ageOn, countryName, flagEmoji, licenseStatus, pilotCredentials, regulatorById, suggestedCurrentTypes, type License, type Pilot } from "@cielo/core";
import { DateField, isValidDate } from "../../src/components/DateField";
import { CountryField } from "../../src/components/CountryField";
import { Badge, Button, Card, Chip, Field, Row, Screen, Txt } from "../../src/components/ui";
import { SuggestField } from "../../src/components/SuggestField";
import { AirportField } from "../../src/components/AirportField";
import { useApp } from "../../src/state";
import { router } from "expo-router";
import { CrewHero, Honours } from "../../src/components/Honours";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../src/theme";

type Draft = Pick<Pilot, "fullName" | "rank" | "employer" | "homeBaseIcao" | "licenceNumber" | "nationality" | "phone" | "bio"> & { birthDate: string; types: string };
const draftOf = (p: Pilot): Draft => ({ fullName: p.fullName, rank: p.rank, employer: p.employer, homeBaseIcao: p.homeBaseIcao, licenceNumber: p.licenceNumber, nationality: p.nationality, phone: p.phone, bio: p.bio, birthDate: p.birthDate ?? "", types: (p.currentTypes ?? []).join(" ") });
const typesOf = (s: string) => [...new Set(s.toUpperCase().split(/[^A-Z0-9]+/).filter((x) => x && x.length <= 6))].slice(0, 12);

export default function Profile() {
  const app = useApp();
  const { t, pilot, licenses, store, locale, flights } = app;
  const today = new Date().toISOString().slice(0, 10);
  const creds = useMemo(() => pilotCredentials(licenses, today), [licenses, today]);
  const suggested = useMemo(() => suggestedCurrentTypes(licenses, flights, today), [licenses, flights, today]);
  // what the app already knows elsewhere: the licence document, its authority's country, the CV draft
  const [cvPhone, setCvPhone] = useState<string | undefined>();
  useEffect(() => {
    void store.getMeta("cv").then((raw) => raw && setCvPhone((JSON.parse(raw) as { phone?: string }).phone || undefined));
  }, [store]);
  const known = useMemo(() => {
    const lic = licenses.find((l) => !l.deletedAt && l.kind === "licence" && l.number);
    const auth = licenses.map((l) => AUTHORITIES.find((a) => a.label === l.authority)).find((a) => a && a.country !== "EU");
    return { licenceNumber: lic?.number, country: auth?.country, phone: cvPhone };
  }, [licenses, cvPhone]);
  const c = useTheme();
  const fill = (x: Draft): Draft => ({ ...x, licenceNumber: x.licenceNumber || known.licenceNumber, phone: x.phone || known.phone });
  const [d, setD] = useState<Draft>(draftOf(pilot));
  const [saved, setSaved] = useState(false);
  // the draft follows the stored profile (sync, other screens) until the pilot starts typing, so a sync in the
  // middle of typing does not wipe what was typed
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setD(fill(draftOf(pilot)));
  }, [pilot, known, touched]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setTouched(true);
    setD((x) => ({ ...x, [k]: v }));
  };
  const validity = (l: License) => {
    const st = licenseStatus(l, today);
    return { text: st.state === "expired" ? t("profile.expired") : l.validUntil ? t("profile.validUntil", { date: l.validUntil }) : t("profile.noExpiry"), color: st.state === "expired" ? c.warning : st.state === "expiring" ? c.caution : c.success };
  };
  const Detail = ({ icon, label, value, sub, badge }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; sub?: string; badge?: { text: string; color: string } }) => (
    <Row style={{ alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${c.text}12` }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${c.accent}1f`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={c.accent} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Txt variant="small" style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Txt>
        <Row style={{ alignItems: "center", flexWrap: "wrap" }} gap={8}>
          <Txt style={{ fontWeight: "700", fontSize: 16 }} color={value ? undefined : c.muted}>{value || "—"}</Txt>
          {badge && value ? <Badge text={badge.text} color={badge.color} /> : null}
        </Row>
        {sub ? <Txt variant="small" numberOfLines={1}>{sub}</Txt> : null}
      </View>
    </Row>
  );

  /** Square photo, compressed JPEG so it stays light to sync. */
  const pickPhoto = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.35, base64: true };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.canceled ? undefined : r.assets[0];
    if (!a?.base64) return;
    await app.savePilot({ photoDataUrl: `data:image/jpeg;base64,${a.base64}` });
  };

  const save = async () => {
    const clean = (s?: string) => s?.trim() || undefined;
    await app.savePilot({
      fullName: d.fullName.trim(),
      rank: clean(d.rank),
      employer: clean(d.employer),
      homeBaseIcao: clean(d.homeBaseIcao)?.toUpperCase(),
      licenceNumber: clean(d.licenceNumber),
      nationality: clean(d.nationality)?.toUpperCase(),
      phone: clean(formatPhoneIntl(d.phone, d.nationality || pilot.nationality)),
      bio: clean(d.bio),
      birthDate: isValidDate(d.birthDate) ? d.birthDate : null,
      currentTypes: typesOf(d.types).length ? typesOf(d.types) : null,
    });
    setTouched(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Screen>
      <CrewHero pilot={pilot} />
      <Row style={{ flexWrap: "wrap" }} gap={8}>
        <Button kind="secondary" small title={t("profile.pickPhoto")} onPress={() => void pickPhoto(false)} />
        <Button kind="secondary" small title={t("profile.takePhoto")} onPress={() => void pickPhoto(true)} />
        {pilot.photoDataUrl ? <Button kind="ghost" small title={t("profile.removePhoto")} onPress={() => void app.savePilot({ photoDataUrl: undefined })} /> : null}
      </Row>
      {!pilot.photoDataUrl ? <Txt variant="small">{t("profile.photoHint")}</Txt> : null}
      <Honours flights={flights} opening={app.balances} />
      <Card>
        <Txt variant="label">{t("profile.details")}</Txt>
        <Detail icon="gift-outline" label={t("profile.birthDate")} value={pilot.birthDate ? `${pilot.birthDate} · ${t("profile.age", { n: ageOn(pilot.birthDate, today) })}` : undefined} />
        <Detail icon="flag-outline" label={t("profile.nationality")} value={pilot.nationality ? `${flagEmoji(pilot.nationality)}  ${countryName(pilot.nationality, locale)}` : undefined} />
        <Pressable onPress={() => router.push("/account")}>
          <Detail icon="mail-outline" label={t("profile.email")} value={app.session?.user.email ?? pilot.email} sub={t("profile.emailChange")} />
        </Pressable>
        <Detail icon="business-outline" label={t("profile.authority")} value={regulatorById(pilot.authority ?? pilot.regulatoryFramework)?.short} sub={regulatorById(pilot.authority ?? pilot.regulatoryFramework)?.name} />
        <Detail icon="card-outline" label={t("profile.licence")} value={creds.licence?.code} sub={pilot.licenceNumber || creds.licence?.number} />
        <Detail icon="pulse-outline" label={t("profile.medical")} value={creds.medical?.code} badge={creds.medical ? validity(creds.medical) : undefined} />
        <Detail icon="language-outline" label={t("profile.language")} value={creds.language?.code} badge={creds.language ? validity(creds.language) : undefined} />
        <View style={{ gap: 6 }}>
          <Txt variant="small">{t("profile.currentTypes")}</Txt>
          {(pilot.currentTypes?.length ? pilot.currentTypes : suggested).length ? (
            <Row style={{ flexWrap: "wrap" }} gap={6}>
              {(pilot.currentTypes?.length ? pilot.currentTypes : suggested).map((x) => (
                <View key={x} style={{ borderRadius: 999, borderWidth: 1, borderColor: c.accent, backgroundColor: `${c.accent}22`, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Txt mono color={c.accent} style={{ fontWeight: "700" }}>✈ {x}</Txt>
                </View>
              ))}
            </Row>
          ) : (
            <Txt variant="muted">—</Txt>
          )}
          {!pilot.currentTypes?.length && suggested.length ? <Txt variant="small">{t("profile.typesAuto")}</Txt> : null}
        </View>
      </Card>
      <Card>
        <Field label={t("more.fullName")} value={d.fullName} onChangeText={(v) => set("fullName", v)} autoCapitalize="words" />
        <SuggestField label={t("profile.rank")} value={d.rank ?? ""} onChange={(v) => set("rank", v)} options={RANKS} placeholder={t("profile.rankPh")} />
        <Field label={t("profile.employer")} value={d.employer ?? ""} onChangeText={(v) => set("employer", v)} />
        <AirportField label={t("more.homeBase")} value={d.homeBaseIcao ?? ""} onChange={(v) => set("homeBaseIcao", v)} />
        <Field
          label={t("more.licenceNumber")}
          value={d.licenceNumber ?? ""}
          onChangeText={(v) => set("licenceNumber", v)}
          monoValue
          autoCapitalize="characters"
          hint={known.licenceNumber && d.licenceNumber === known.licenceNumber && !pilot.licenceNumber ? t("profile.fromLicence") : undefined}
        />
        <CountryField label={t("profile.nationality")} value={d.nationality} onChange={(v) => set("nationality", v)} />
        {!d.nationality && known.country ? (
          <Button kind="ghost" small title={t("profile.suggestCountry", { country: countryName(known.country, locale) })} onPress={() => set("nationality", known.country)} />
        ) : null}
        <DateField label={t("profile.birthDate")} value={d.birthDate} onChange={(v) => set("birthDate", v)} />
        <Field label={t("profile.currentTypes")} value={d.types} onChangeText={(v) => set("types", v.toUpperCase())} autoCapitalize="characters" monoValue placeholder="A320 C68A" hint={t("profile.currentTypesHint")} />
        {suggested.filter((x) => !typesOf(d.types).includes(x)).length ? (
          <Row style={{ flexWrap: "wrap" }} gap={6}>
            {suggested
              .filter((x) => !typesOf(d.types).includes(x))
              .map((x) => (
                <Chip key={x} label={`+ ${x}`} onPress={() => set("types", [...typesOf(d.types), x].join(" "))} />
              ))}
          </Row>
        ) : null}
        <Field label={t("profile.phone")} value={d.phone ?? ""} onChangeText={(v) => set("phone", v)} onBlur={() => set("phone", formatPhoneIntl(d.phone, d.nationality || pilot.nationality) || undefined)} placeholder="+33 6 12 34 56 78" keyboardType="phone-pad" />
        <Field label={t("profile.bio")} value={d.bio ?? ""} onChangeText={(v) => set("bio", v)} multiline maxLength={600} />
        <Button title={saved ? t("more.saved") : t("common.save")} onPress={save} />
      </Card>
    </Screen>
  );
}
