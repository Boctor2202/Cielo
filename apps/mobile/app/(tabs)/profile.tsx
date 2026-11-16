import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { AUTHORITIES, countryName, type Pilot } from "@cielo/core";
import { CountryField } from "../../src/components/CountryField";
import { Button, Card, Field, Row, Screen, Txt } from "../../src/components/ui";
import { AirportField } from "../../src/components/AirportField";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

type Draft = Pick<Pilot, "fullName" | "rank" | "employer" | "homeBaseIcao" | "licenceNumber" | "nationality" | "phone" | "bio">;
const draftOf = (p: Pilot): Draft => ({ fullName: p.fullName, rank: p.rank, employer: p.employer, homeBaseIcao: p.homeBaseIcao, licenceNumber: p.licenceNumber, nationality: p.nationality, phone: p.phone, bio: p.bio });

export default function Profile() {
  const app = useApp();
  const { t, pilot, licenses, store, locale } = app;
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
  useEffect(() => setD(fill(draftOf(pilot))), [pilot, known]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const initials = (d.fullName || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

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
      phone: clean(d.phone),
      bio: clean(d.bio),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Screen>
      <Card>
        <Row style={{ alignItems: "center", gap: 14 }}>
          {pilot.photoDataUrl ? (
            <Image source={{ uri: pilot.photoDataUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} contentFit="cover" />
          ) : (
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <Txt style={{ fontSize: 26, fontWeight: "700" }} color="#fff">{initials}</Txt>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="h2">{pilot.fullName || "—"}</Txt>
            <Txt variant="muted">{[pilot.rank, pilot.employer, pilot.homeBaseIcao].filter(Boolean).join(" · ")}</Txt>
          </View>
        </Row>
        {!pilot.photoDataUrl ? <Txt variant="small">{t("profile.photoHint")}</Txt> : null}
        <Row style={{ flexWrap: "wrap" }} gap={8}>
          <Button kind="secondary" small title={t("profile.pickPhoto")} onPress={() => void pickPhoto(false)} />
          <Button kind="secondary" small title={t("profile.takePhoto")} onPress={() => void pickPhoto(true)} />
          {pilot.photoDataUrl ? <Button kind="ghost" small title={t("profile.removePhoto")} onPress={() => void app.savePilot({ photoDataUrl: undefined })} /> : null}
        </Row>
      </Card>
      <Card>
        <Field label={t("more.fullName")} value={d.fullName} onChangeText={(v) => set("fullName", v)} autoCapitalize="words" />
        <Field label={t("profile.rank")} value={d.rank ?? ""} onChangeText={(v) => set("rank", v)} placeholder={t("profile.rankPh")} />
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
        <Field label={t("profile.phone")} value={d.phone ?? ""} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
        <Field label={t("profile.bio")} value={d.bio ?? ""} onChangeText={(v) => set("bio", v)} multiline maxLength={600} />
        <Button title={saved ? t("more.saved") : t("common.save")} onPress={save} />
      </Card>
    </Screen>
  );
}
