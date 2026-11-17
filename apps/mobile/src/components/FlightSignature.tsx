import React, { useEffect, useState } from "react";
import { Alert, Modal, ScrollView, Share, View } from "react-native";
import * as Crypto from "expo-crypto";
import Ionicons from "@expo/vector-icons/Ionicons";
import { canonicalFlightContent, type Flight, type Signature } from "@cielo/core";
import { formatDate, type I18nKey } from "../i18n";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Button, Card, Chip, Field, Row, Txt } from "./ui";
import { SignatureImage, SignaturePad, signatureSvg } from "./SignaturePad";
import { createSignLink } from "../crew";

const ROLES = ["instructor", "captain", "examiner", "other"] as const;
const hash = (f: Flight) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalFlightContent(f));

/** Signature of a logged flight: who signed, and whether the flight is unchanged since (SHA-256 of its content). */
export function FlightSignature({ flight }: { flight: Flight }) {
  const { t, locale, store, pilot, put, remove, access, session } = useApp();
  const [linkBusy, setLinkBusy] = useState(false);
  const c = useTheme();
  const [sig, setSig] = useState<{ s: Signature; valid: boolean } | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(flight.picName ?? "");
  const [role, setRole] = useState<Signature["signerRole"]>(flight.function === "DUAL" ? "instructor" : "captain");
  const [licence, setLicence] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!flight.signatureId) return alive && setSig(null);
      const s = await store.get("signatures", flight.signatureId);
      if (!s || s.deletedAt) return alive && setSig(null);
      const h = await hash(flight);
      if (alive) setSig({ s, valid: h === s.contentHash });
    })();
    return () => {
      alive = false;
    };
  }, [flight, store]);

  if (!access.has("signature") || sig === undefined) return null;

  const sign = async () => {
    setSaving(true);
    try {
      const s = await put("signatures", {
        pilotId: pilot.id,
        flightId: flight.id,
        signerName: name.trim(),
        signerRole: role,
        signerLicenceNumber: licence.trim() || undefined,
        signedAt: new Date().toISOString(),
        imageDataUrl: signatureSvg(paths),
        contentHash: await hash(flight),
      });
      await put("flights", { ...flight, signatureId: s.id, locked: true });
      setOpen(false);
      setPaths([]);
    } finally {
      setSaving(false);
    }
  };
  // a link for a signer without Geardown: opened in their browser (the flight must be synced first)
  const sendLink = async () => {
    setLinkBusy(true);
    try {
      const r = await createSignLink(session?.access_token, { flightIds: [flight.id], signerName: name.trim(), signerRole: role, locale });
      setOpen(false);
      await Share.share({ message: t("crew.linkMessage", { n: r.flights, url: r.url }) });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      Alert.alert(t("common.error"), code === "plan" ? t("crew.err.plan") : code === "signin" ? t("crew.signin") : t("sig.linkErr"));
    } finally {
      setLinkBusy(false);
    }
  };
  const unsign = async () => {
    if (sig) await remove("signatures", sig.s.id);
    await put("flights", { ...flight, signatureId: null, locked: false });
  };

  return (
    <Card>
      <Txt variant="h2">{t("sig.title")}</Txt>
      {sig ? (
        <View style={{ gap: 6 }}>
          <Row>
            <Ionicons name={sig.valid ? "shield-checkmark" : "shield-outline"} size={18} color={sig.valid ? c.success : c.warning} />
            <Txt style={{ flex: 1, fontWeight: "600" }} color={sig.valid ? c.success : c.warning}>{t(sig.valid ? "sig.valid" : "sig.invalid")}</Txt>
          </Row>
          <Txt variant="small">
            {t("sig.by", { name: sig.s.signerName, role: t(`sig.role.${sig.s.signerRole}` as I18nKey), date: formatDate(sig.s.signedAt.slice(0, 10), locale) })}
          </Txt>
          <View style={{ backgroundColor: "#fff", borderRadius: 8, padding: 4 }}>
            <SignatureImage dataUrl={sig.s.imageDataUrl} />
          </View>
          <Txt variant="small" mono numberOfLines={1}>SHA-256 {sig.s.contentHash.slice(0, 24)}…</Txt>
          <Button kind="ghost" small title={t("sig.remove")} onPress={() => void unsign()} />
        </View>
      ) : (
        <>
          <Txt variant="small">{t("sig.hint")}</Txt>
          <Button kind="secondary" title={t("sig.ask")} onPress={() => setOpen(true)} />
        </>
      )}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 12 }} scrollEnabled={false} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: "space-between" }}>
            <Txt variant="h2">{t("sig.title")}</Txt>
            <Ionicons name="close" size={22} color={c.muted} onPress={() => setOpen(false)} />
          </Row>
          <Txt variant="small" mono>
            {formatDate(flight.date, locale)} · {flight.depIcao}→{flight.arrIcao}{flight.registration ? ` · ${flight.registration}` : ""}
          </Txt>
          <Field label={t("sig.name")} value={name} onChangeText={setName} autoCapitalize="words" />
          <Row style={{ flexWrap: "wrap" }} gap={6}>
            {ROLES.map((r) => (
              <Chip key={r} label={t(`sig.role.${r}` as I18nKey)} selected={role === r} onPress={() => setRole(r)} />
            ))}
          </Row>
          <Field label={t("sig.licence")} value={licence} onChangeText={setLicence} monoValue autoCapitalize="characters" />
          <Txt variant="label">{t("sig.draw")}</Txt>
          <SignaturePad key={open ? "open" : "closed"} onChange={setPaths} />
          <Row style={{ justifyContent: "space-between" }}>
            <Button kind="ghost" small title={t("sig.clear")} onPress={() => (setPaths([]), setOpen(false), setTimeout(() => setOpen(true), 50))} />
            <Txt variant="small">{t("sig.lock")}</Txt>
          </Row>
          <Button title={t("sig.save")} disabled={!name.trim() || paths.length === 0} loading={saving} onPress={() => void sign()} />
          <Txt variant="small" style={{ marginTop: 8 }}>{t("sig.linkHint")}</Txt>
          <Button
            kind="secondary"
            title={t("sig.sendLink")}
            disabled={!name.trim()}
            loading={linkBusy}
            onPress={() => void sendLink()}
          />
        </ScrollView>
      </Modal>
    </Card>
  );
}
