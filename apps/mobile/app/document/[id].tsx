import React, { useMemo, useState } from "react";
import { AuthorityField } from "../../src/components/AuthorityField";
import { AircraftTypeField, ratingTitle } from "../../src/components/AircraftTypeField";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { DEFAULT_ALERT_DAYS, LICENSE_CATALOGUE, licenseStatus, LPE_LANGUAGES, lpeCode, lpeValidUntil, parseLpe, type License, type LicenseKind } from "@cielo/core";
import { Badge, Button, Card, Chip, Field, Row, Screen, Txt, statusColor } from "../../src/components/ui";
import type { I18nKey } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { useTheme } from "../../src/theme";
import { statusLabel } from "../../src/licenseLabel";
import { Paywall } from "../../src/components/Access";
import { ensureNotificationPermission } from "../../src/notifications";

const KINDS: LicenseKind[] = ["licence", "medical", "rating", "endorsement", "language", "other"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function DocumentFormRoute() {
  const { access } = useApp();
  // read-only without a live subscription: viewing stays possible from the lists, editing does not
  if (!access.canWrite) return <Paywall />;
  return <DocumentForm />;
}

function DocumentForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, licenses, pilot, put, remove, aircraftTypes } = useApp();
  const c = useTheme();
  const existing = id && id !== "new" ? licenses.find((l) => l.id === id) : undefined;

  const [kind, setKind] = useState<LicenseKind>(existing?.kind ?? "licence");
  const [code, setCode] = useState(existing?.code ?? "");
  const [authority, setAuthority] = useState(existing?.authority ?? (pilot.regulatoryFramework === "EASA" ? "DGAC France" : ""));
  const [number, setNumber] = useState(existing?.number ?? pilot.licenceNumber ?? "");
  const [issuedOn, setIssuedOn] = useState(existing?.issuedOn ?? "");
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? "");
  const [lastCheckOn, setLastCheckOn] = useState(existing?.lastCheckOn ?? "");
  const [alertDays, setAlertDays] = useState((existing?.alertDays ?? DEFAULT_ALERT_DAYS).join(", "));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState(false);

  const suggestions = useMemo(() => LICENSE_CATALOGUE.filter((x) => x.kind === kind), [kind]);
  const parsedAlerts = alertDays
    .split(/[,;\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const status = licenseStatus({ validUntil: DATE_RE.test(validUntil) ? validUntil : null, alertDays: parsedAlerts }, todayUtc());

  const validDate = (s: string) => s === "" || (DATE_RE.test(s) && !Number.isNaN(Date.parse(s)));

  const save = async () => {
    if (!code.trim() || ![issuedOn, validUntil, lastCheckOn].every(validDate)) return setError(true);
    const row: Partial<License> = {
      ...existing,
      pilotId: pilot.id,
      kind,
      code: code.trim(),
      authority: authority.trim() || undefined,
      number: number.trim() || undefined,
      issuedOn: issuedOn || null,
      validUntil: validUntil || null,
      lastCheckOn: lastCheckOn || null,
      alertDays: parsedAlerts.length ? parsedAlerts : DEFAULT_ALERT_DAYS,
      notes: notes.trim() || undefined,
    };
    await put("licenses", row); // reschedules local notifications
    if (row.validUntil && !(await ensureNotificationPermission().catch(() => false))) Alert.alert(t("docs.notifDenied"));
    router.back();
  };

  const del = () =>
    existing &&
    Alert.alert(t("docs.deleteTitle"), existing.code, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await remove("licenses", existing.id);
          router.back();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          title: existing ? t("docs.edit") : t("docs.new"),
          headerRight: () => <Button kind="ghost" small title={t("common.save")} onPress={save} />,
        }}
      />
      <Screen backdrop>
        <Card>
          <Txt variant="label">{t("docs.kind")}</Txt>
          <Row style={{ flexWrap: "wrap" }}>
            {KINDS.map((k) => (
              <Chip
                key={k}
                label={t(`docs.kind.${k}` as I18nKey)}
                selected={kind === k}
                onPress={() => {
                  setKind(k);
                  if (k === "language" && !/^LPE/i.test(code)) setCode("LPE English");
                }}
              />
            ))}
          </Row>
          {kind === "rating" ? <AircraftTypeField types={aircraftTypes} label={t("docs.aircraftType")} hint={t("docs.aircraftTypeHint")} onPick={(ty) => setCode(ratingTitle(ty))} /> : null}
          {kind === "language" ? (
            (() => {
              const { language, level } = parseLpe(code);
              const update = (lang: string, lvl?: number) => {
                setCode(lpeCode(lang || "English", lvl));
                if (lvl) setValidUntil(lpeValidUntil(lvl, validDate(issuedOn ?? "") ? issuedOn : null) ?? "");
              };
              return (
                <>
                  <Field label={t("lpe.language")} value={language} onChangeText={(v) => update(v, level)} error={error && !language.trim()} />
                  <Row style={{ flexWrap: "wrap" }}>
                    {LPE_LANGUAGES.map((l) => (
                      <Chip key={l} label={l} selected={language === l} onPress={() => update(l, level)} />
                    ))}
                  </Row>
                  <Txt variant="label">{t("lpe.level")}</Txt>
                  <Row style={{ flexWrap: "wrap" }}>
                    {[4, 5, 6].map((n) => (
                      <Chip key={n} label={`${n} · ${t(`lpe.l${n}` as I18nKey)}`} selected={level === n} onPress={() => update(language, n)} />
                    ))}
                  </Row>
                  {level ? <Txt variant="small">{t(`lpe.v${level}` as I18nKey)}</Txt> : null}
                </>
              );
            })()
          ) : (
            <>
              <Field label={t("docs.code")} value={code} onChangeText={setCode} placeholder={t("docs.codePlaceholder")} error={error && !code.trim()} />
              <Row style={{ flexWrap: "wrap" }}>
                {suggestions.map((s) => (
                  <Chip key={s.code} label={s.code} selected={code === s.code} onPress={() => setCode(s.code)} />
                ))}
              </Row>
            </>
          )}
        </Card>
        <Card>
          <AuthorityField label={t("docs.authority")} value={authority} onChange={setAuthority} />
          {kind !== "language" ? <Field label={t("docs.number")} value={number} onChangeText={setNumber} monoValue autoCapitalize="characters" /> : null}
          <Row>
            <Field
              style={{ flex: 1 }}
              label={kind === "language" ? t("lpe.assessedOn") : t("docs.issuedOn")}
              value={issuedOn ?? ""}
              onChangeText={(v) => {
                setIssuedOn(v);
                const lvl = kind === "language" ? parseLpe(code).level : undefined;
                if (lvl && validDate(v) && v.length === 10) setValidUntil(lpeValidUntil(lvl, v) ?? "");
              }}
              placeholder="YYYY-MM-DD"
              monoValue
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              error={!validDate(issuedOn ?? "")}
            />
            <Field
              style={{ flex: 1 }}
              label={t("docs.validUntil")}
              value={validUntil ?? ""}
              onChangeText={setValidUntil}
              placeholder="YYYY-MM-DD"
              monoValue
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              error={!validDate(validUntil ?? "")}
            />
          </Row>
          {kind !== "language" ? (
          <Field
              label={t("docs.lastCheckOn")}
              value={lastCheckOn ?? ""}
              onChangeText={setLastCheckOn}
              placeholder="YYYY-MM-DD"
              monoValue
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              error={!validDate(lastCheckOn ?? "")}
            />
          ) : null}
          <Field label={t("docs.alertDays")} value={alertDays} onChangeText={setAlertDays} monoValue keyboardType="numbers-and-punctuation" />
          <Row>
            <Badge text={statusLabel(t, status)} color={statusColor(c, status.state)} />
          </Row>
        </Card>
        <Card>
          <Field label={t("docs.notes")} value={notes} onChangeText={setNotes} multiline />
        </Card>
        {error ? <Txt color={c.warning}>{t("docs.invalid")}</Txt> : null}
        <Button title={t("common.save")} onPress={save} />
        {existing ? <Button kind="danger" title={t("common.delete")} onPress={del} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
