import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import type { Pilot } from "@cielo/core";
import { Button, Card, Field, Row, Screen, Txt } from "../../src/components/ui";
import { AirportField } from "../../src/components/AirportField";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

type Draft = Pick<Pilot, "fullName" | "rank" | "employer" | "homeBaseIcao" | "licenceNumber" | "nationality" | "phone" | "bio">;
const draftOf = (p: Pilot): Draft => ({ fullName: p.fullName, rank: p.rank, employer: p.employer, homeBaseIcao: p.homeBaseIcao, licenceNumber: p.licenceNumber, nationality: p.nationality, phone: p.phone, bio: p.bio });

export default function Profile() {
  const app = useApp();
  const { t, pilot } = app;
  const c = useTheme();
  const [d, setD] = useState<Draft>(draftOf(pilot));
  const [saved, setSaved] = useState(false);
  useEffect(() => setD(draftOf(pilot)), [pilot]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const initials = (d.fullName || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

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
      </Card>
      <Card>
        <Field label={t("more.fullName")} value={d.fullName} onChangeText={(v) => set("fullName", v)} autoCapitalize="words" />
        <Field label={t("profile.rank")} value={d.rank ?? ""} onChangeText={(v) => set("rank", v)} placeholder={t("profile.rankPh")} />
        <Field label={t("profile.employer")} value={d.employer ?? ""} onChangeText={(v) => set("employer", v)} />
        <AirportField label={t("more.homeBase")} value={d.homeBaseIcao ?? ""} onChange={(v) => set("homeBaseIcao", v)} />
        <Field label={t("more.licenceNumber")} value={d.licenceNumber ?? ""} onChangeText={(v) => set("licenceNumber", v)} monoValue autoCapitalize="characters" />
        <Field label={t("profile.nationality")} value={d.nationality ?? ""} onChangeText={(v) => set("nationality", v)} autoCapitalize="characters" maxLength={3} />
        <Field label={t("profile.phone")} value={d.phone ?? ""} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
        <Field label={t("profile.bio")} value={d.bio ?? ""} onChangeText={(v) => set("bio", v)} multiline maxLength={600} />
        <Button title={saved ? t("more.saved") : t("common.save")} onPress={save} />
      </Card>
    </Screen>
  );
}
