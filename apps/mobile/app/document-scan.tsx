import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import Ionicons from "@expo/vector-icons/Ionicons";
import { planScan, type ScanPlanItem, type ScannedDocument } from "@cielo/core";
import { API_URL } from "../src/api";
import { Button, Card, Field, Row, Txt, tap } from "../src/components/ui";
import { Paywall } from "../src/components/Access";
import { DateField, isValidDate } from "../src/components/DateField";
import type { I18nKey } from "../src/i18n";
import { useApp } from "../src/state";
import { space, useTheme } from "../src/theme";

const CONSENT_KEY = "docScanConsentAt";
type Row = ScanPlanItem & { on: boolean };

/**
 * "Read a document": a photo or the PDF of a licence or a medical certificate, read by Claude on the server,
 * every entry checked before it is saved. Nothing of the document is kept.
 */
export default function DocumentScanScreen() {
  const { t, access, session, store, licenses, putMany, pilot } = useApp();
  const c = useTheme();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void store.getMeta(CONSENT_KEY).then((v) => setConsent(!!v));
  }, [store]);
  const toggleConsent = (v: boolean) => {
    setConsent(v);
    void store.setMeta(CONSENT_KEY, v ? new Date().toISOString() : "");
  };

  if (!access.has("scan")) return <Paywall feature="scan" />;

  const fail = (code?: string) =>
    Alert.alert(t("dscan.title"), t(`dscan.err.${["plan", "rate_limited", "refused", "unreadable", "bad_request", "unauthorized"].includes(code ?? "") ? code : "failed"}` as I18nKey));

  const send = async (body: Record<string, unknown>) => {
    if (!consent) return Alert.alert(t("dscan.title"), t("dscan.needConsent"));
    if (!session?.access_token) return fail("unauthorized");
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/document-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${session.access_token}`, "x-client": Platform.OS },
        body: JSON.stringify({ ...body, consent: true }),
      });
      const d = (await r.json().catch(() => ({}))) as { entries?: ScannedDocument[]; error?: string };
      if (!r.ok) return fail(d.error);
      if (!d.entries?.length) return Alert.alert(t("dscan.title"), t("dscan.none"));
      setRows(planScan(d.entries, licenses).map((p) => ({ ...p, on: p.action !== "same" })));
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  };

  const photos = async (camera: boolean) => {
    tap();
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, base64: true, allowsMultipleSelection: !camera, selectionLimit: 4 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return;
    const images = r.assets.filter((a) => a.base64).slice(0, 4).map((a) => ({ data: a.base64!, type: "image/jpeg" }));
    if (images.length) await send({ images });
  };
  const pdf = async () => {
    tap();
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf"], copyToCacheDirectory: true });
    const a = res.canceled ? undefined : res.assets?.[0];
    if (!a) return;
    const file = new File(a.uri);
    if ((file.size ?? 0) > 8_000_000) return fail("bad_request");
    await send({ pdf: await file.base64() });
  };

  const edit = (i: number, patch: Partial<Row["draft"]>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, on: true, draft: { ...r.draft, ...patch } } : r)));
  const chosen = rows?.filter((r) => r.on) ?? [];
  const save = async () => {
    if (chosen.some((r) => [r.draft.issuedOn, r.draft.validUntil, r.draft.lastCheckOn].some((d) => d && !isValidDate(d)))) return Alert.alert(t("dscan.title"), t("dscan.badDate"));
    setSaving(true);
    try {
      await putMany("licenses", chosen.map((r) => ({ ...r.draft, pilotId: pilot.id })));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (rows)
    return (
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Txt variant="small">{t("dscan.check")}</Txt>
        {rows.map((r, i) => (
          <Card key={i} style={{ gap: 8, borderWidth: 1, borderColor: r.on ? c.accent : "transparent" }}>
            <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="label">{t(`docs.kind.${r.draft.kind}` as I18nKey)} · {t(`dscan.action.${r.action}` as I18nKey)}</Txt>
              </View>
              <Switch value={r.on} onValueChange={(v) => setRows((rs) => rs!.map((x, j) => (j === i ? { ...x, on: v } : x)))} />
            </Row>
            <Field value={r.draft.code} onChangeText={(v) => edit(i, { code: v })} />
            {(["issuedOn", "validUntil"] as const).map((f) => (
              <DateField
                key={f}
                label={t(`dscan.f.${f}` as I18nKey) + (r.changes.includes(f) ? " •" : "")}
                value={r.draft[f] ?? ""}
                onChange={(v) => edit(i, { [f]: v || null })}
              />
            ))}
            {r.draft.number || r.draft.authority ? <Txt variant="small">{[r.draft.authority, r.draft.number].filter(Boolean).join(" · ")}</Txt> : null}
            {r.draft.kind === "medical" && r.draft.notes?.match(/^Limitations?: .*$/m) ? <Txt variant="small">{r.draft.notes.match(/^Limitations?: .*$/m)![0]}</Txt> : null}
          </Card>
        ))}
        <Button title={t("dscan.save", { n: chosen.length })} disabled={!chosen.length} loading={saving} onPress={() => void save()} />
        <Button kind="ghost" title={t("dscan.again")} onPress={() => setRows(null)} />
      </ScrollView>
    );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 60 }}>
      <Txt>{t("dscan.intro")}</Txt>
      <Card style={{ gap: 6 }}>
        <Row gap={6} style={{ alignItems: "center" }}>
          <Ionicons name="shield-checkmark-outline" size={16} color={c.accent} />
          <Txt style={{ fontWeight: "700" }}>{t("dscan.privacyTitle")}</Txt>
        </Row>
        <Txt variant="small">{t("dscan.privacy")}</Txt>
      </Card>
      <Row gap={12} style={{ alignItems: "center" }}>
        <Switch value={consent} onValueChange={toggleConsent} />
        <Txt variant="small" style={{ flex: 1 }}>{t("dscan.consent")}</Txt>
      </Row>
      {busy ? (
        <Row gap={8} style={{ justifyContent: "center", padding: 24 }}>
          <ActivityIndicator />
          <Txt variant="small">{t("dscan.reading")}</Txt>
        </Row>
      ) : (
        <View style={{ gap: 10, opacity: consent ? 1 : 0.5 }}>
          <Button title={t("dscan.camera")} onPress={() => void photos(true)} />
          <Button kind="secondary" title={t("dscan.library")} onPress={() => void photos(false)} />
          <Button kind="secondary" title={t("dscan.pdf")} onPress={() => void pdf()} />
        </View>
      )}
    </ScrollView>
  );
}
