import React, { useMemo, useState } from "react";
import { AuthorityField } from "../../src/components/AuthorityField";
import {
  AircraftTypeField,
  ratingTitle,
} from "../../src/components/AircraftTypeField";
import { Alert, KeyboardAvoidingView, Platform, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  DEFAULT_ALERT_DAYS,
  LICENSE_CATALOGUE,
  licenseStatus,
  LPE_LANGUAGES,
  DOCUMENT_FORMS,
  MEDICAL_CLASSES,
  MEDICAL_LIMITATIONS,
  AGE_BANDS,
  medicalValidUntil,
  type AgeBand,
  type MedicalClass,
  lpeCode,
  lpeValidUntil,
  parseLpe,
  type License,
  type LicenseKind,
} from "@cielo/core";
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Row,
  Screen,
  ToggleRow,
  Txt,
  statusColor,
} from "../../src/components/ui";
import type { I18nKey } from "../../src/i18n";
import { todayUtc, useApp } from "../../src/state";
import { useTheme } from "../../src/theme";
import { statusLabel } from "../../src/licenseLabel";
import { Paywall } from "../../src/components/Access";
import { ensureNotificationPermission } from "../../src/notifications";
import { DateField } from "../../src/components/DateField";

const KINDS: LicenseKind[] = [
  "licence",
  "medical",
  "rating",
  "endorsement",
  "language",
  "other",
];
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
  const existing =
    id && id !== "new" ? licenses.find((l) => l.id === id) : undefined;

  const [kind, setKind] = useState<LicenseKind>(existing?.kind ?? "licence");
  const [code, setCode] = useState(existing?.code ?? "");
  const [authority, setAuthority] = useState(
    existing?.authority ??
      (pilot.regulatoryFramework === "EASA" ? "DGAC France" : ""),
  );
  const [number, setNumber] = useState(
    existing?.number ?? pilot.licenceNumber ?? "",
  );
  const [issuedOn, setIssuedOn] = useState(existing?.issuedOn ?? "");
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? "");
  const [lastCheckOn, setLastCheckOn] = useState(existing?.lastCheckOn ?? "");
  const [alertDays, setAlertDays] = useState(
    (existing?.alertDays ?? DEFAULT_ALERT_DAYS).join(", "),
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState(false);
  const [age, setAge] = useState<AgeBand>("u40");
  const [spPax, setSpPax] = useState(false);
  const form = DOCUMENT_FORMS[kind];
  const [showExpiry, setShowExpiry] = useState(false);

  const suggestions = useMemo(
    () => LICENSE_CATALOGUE.filter((x) => x.kind === kind),
    [kind],
  );
  const parsedAlerts = alertDays
    .split(/[,;\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const status = licenseStatus(
    {
      validUntil: DATE_RE.test(validUntil) ? validUntil : null,
      alertDays: parsedAlerts,
    },
    todayUtc(),
  );

  const validDate = (s: string) =>
    s === "" || (DATE_RE.test(s) && !Number.isNaN(Date.parse(s)));

  const save = async () => {
    if (!code.trim() || ![issuedOn, validUntil, lastCheckOn].every(validDate))
      return setError(true);
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
    if (
      row.validUntil &&
      !(await ensureNotificationPermission().catch(() => false))
    )
      Alert.alert(t("docs.notifDenied"));
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: existing ? t("docs.edit") : t("docs.new"),
          headerRight: () => (
            <Button
              kind="ghost"
              small
              title={t("common.save")}
              onPress={save}
            />
          ),
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
                  if (k === kind) return;
                  setKind(k);
                  setCode(
                    k === "language"
                      ? "LPE English"
                      : k === "medical"
                        ? "Class 1"
                        : "",
                  );
                  setIssuedOn("");
                  setValidUntil("");
                  setLastCheckOn("");
                  setNotes((n) =>
                    n.replace(/^Limitations?: .*$\n?/m, "").trim(),
                  );
                }}
              />
            ))}
          </Row>
          {kind === "rating" ? (
            <AircraftTypeField
              types={aircraftTypes}
              label={t("docs.aircraftType")}
              hint={t("docs.aircraftTypeHint")}
              onPick={(ty) => setCode(ratingTitle(ty))}
            />
          ) : null}
          {kind === "medical" ? (
            (() => {
              const cls = (MEDICAL_CLASSES as string[]).includes(code)
                ? (code as MedicalClass)
                : "Class 1";
              const recompute = (
                c: MedicalClass,
                exam: string,
                a: AgeBand,
                sp: boolean,
              ) => {
                if (exam.length === 10 && validDate(exam))
                  setValidUntil(medicalValidUntil(c, exam, a, sp) ?? "");
              };
              const lims =
                notes
                  .match(/^Limitations?: (.*)$/m)?.[1]
                  ?.split(/,\s*/)
                  .filter(Boolean) ?? [];
              const toggleLim = (l: string) => {
                const set = lims.includes(l)
                  ? lims.filter((x) => x !== l)
                  : [...lims, l];
                const rest = notes.replace(/^Limitations?: .*$\n?/m, "").trim();
                setNotes(
                  [set.length ? `Limitations: ${set.join(", ")}` : "", rest]
                    .filter(Boolean)
                    .join("\n"),
                );
              };
              return (
                <>
                  <Txt variant="label">{t("med.class")}</Txt>
                  <Row style={{ flexWrap: "wrap" }}>
                    {MEDICAL_CLASSES.map((c) => (
                      <Chip
                        key={c}
                        label={t(`med.cls.${c.replace(/\s/g, "")}` as I18nKey)}
                        selected={cls === c}
                        onPress={() => (
                          setCode(c),
                          recompute(c, issuedOn ?? "", age, spPax)
                        )}
                      />
                    ))}
                  </Row>
                  <Txt variant="label">{t("med.age")}</Txt>
                  <Row style={{ flexWrap: "wrap" }}>
                    {AGE_BANDS.map((a) => (
                      <Chip
                        key={a}
                        label={t(`med.ages.${a}` as I18nKey)}
                        selected={age === a}
                        onPress={() => (
                          setAge(a),
                          recompute(cls, issuedOn ?? "", a, spPax)
                        )}
                      />
                    ))}
                  </Row>
                  {cls === "Class 1" ? (
                    <ToggleRow
                      label={t("med.singlePilotPax")}
                      value={spPax}
                      onChange={(v) => (
                        setSpPax(v),
                        recompute(cls, issuedOn ?? "", age, v)
                      )}
                    />
                  ) : null}
                  <Txt variant="label">{t("med.limitations")}</Txt>
                  <Row style={{ flexWrap: "wrap" }}>
                    {MEDICAL_LIMITATIONS.map((l) => (
                      <Chip
                        key={l}
                        label={l}
                        selected={lims.includes(l)}
                        onPress={() => toggleLim(l)}
                      />
                    ))}
                  </Row>
                  {lims.length ? (
                    <Txt variant="small">
                      {lims
                        .map((l) => `${l} : ${t(`med.lim.${l}` as I18nKey)}`)
                        .join(" · ")}
                    </Txt>
                  ) : null}
                </>
              );
            })()
          ) : kind === "language" ? (
            (() => {
              const { language, level } = parseLpe(code);
              const update = (lang: string, lvl?: number) => {
                setCode(lpeCode(lang || "English", lvl));
                if (lvl)
                  setValidUntil(
                    lpeValidUntil(
                      lvl,
                      validDate(issuedOn ?? "") ? issuedOn : null,
                    ) ?? "",
                  );
              };
              return (
                <>
                  <Field
                    label={t("lpe.language")}
                    value={language}
                    onChangeText={(v) => update(v, level)}
                    error={error && !language.trim()}
                  />
                  <Row style={{ flexWrap: "wrap" }}>
                    {LPE_LANGUAGES.map((l) => (
                      <Chip
                        key={l}
                        label={l}
                        selected={language === l}
                        onPress={() => update(l, level)}
                      />
                    ))}
                  </Row>
                  <Txt variant="label">{t("lpe.level")}</Txt>
                  <Row style={{ flexWrap: "wrap" }}>
                    {[4, 5, 6].map((n) => (
                      <Chip
                        key={n}
                        label={`${n} · ${t(`lpe.l${n}` as I18nKey)}`}
                        selected={level === n}
                        onPress={() => update(language, n)}
                      />
                    ))}
                  </Row>
                  {level ? (
                    <Txt variant="small">{t(`lpe.v${level}` as I18nKey)}</Txt>
                  ) : null}
                </>
              );
            })()
          ) : (
            <>
              <Field
                label={t("docs.code")}
                value={code}
                onChangeText={setCode}
                placeholder={t("docs.codePlaceholder")}
                error={error && !code.trim()}
              />
              <Row style={{ flexWrap: "wrap" }}>
                {suggestions.map((s) => (
                  <Chip
                    key={s.code}
                    label={s.code}
                    selected={code === s.code}
                    onPress={() => setCode(s.code)}
                  />
                ))}
              </Row>
            </>
          )}
        </Card>
        <Card>
          {form.authority === "authority" ? (
            <AuthorityField
              label={t("docs.authority")}
              value={authority}
              onChange={setAuthority}
            />
          ) : null}
          {form.authority === "aemc" || form.authority === "organisation" ? (
            <Field
              label={t(
                form.authority === "aemc" ? "med.aemc" : "docs.organisation",
              )}
              value={authority}
              onChangeText={setAuthority}
              placeholder={form.authority === "aemc" ? "AeMC, Dr …" : undefined}
            />
          ) : null}
          {form.number ? (
            <Field
              label={t(
                kind === "licence" ? "docs.licenceNumber" : "docs.number",
              )}
              value={number}
              onChangeText={setNumber}
              monoValue
              autoCapitalize="characters"
            />
          ) : null}
          <Row>
            <DateField
              style={{ flex: 1 }}
              label={t(`docs.date.${form.issued || "issuedOn"}` as I18nKey)}
              value={issuedOn ?? ""}
              quick={["today"]}
              onChange={(v) => {
                setIssuedOn(v);
                if (!(validDate(v) && v.length === 10)) return;
                const lvl =
                  kind === "language" ? parseLpe(code).level : undefined;
                if (lvl) setValidUntil(lpeValidUntil(lvl, v) ?? "");
                if (kind === "medical")
                  setValidUntil(
                    medicalValidUntil(
                      (MEDICAL_CLASSES as string[]).includes(code)
                        ? (code as MedicalClass)
                        : "Class 1",
                      v,
                      age,
                      spPax,
                    ) ?? "",
                  );
              }}
            />
            {form.validity === true ||
            (form.validity === "optional" && (showExpiry || !!validUntil)) ? (
              <DateField
                style={{ flex: 1 }}
                label={t("docs.validUntil")}
                value={validUntil ?? ""}
                onChange={setValidUntil}
                quick={["plus1y", "plus2y", "plus5y"]}
              />
            ) : null}
          </Row>
          {form.validity === "optional" && !showExpiry && !validUntil ? (
            <View style={{ gap: 4 }}>
              <Txt variant="small">{t("docs.noExpiryLicence")}</Txt>
              <Button
                kind="ghost"
                small
                title={t("docs.addExpiry")}
                onPress={() => setShowExpiry(true)}
              />
            </View>
          ) : null}
          {form.lastCheck ? (
            <DateField
              label={t("docs.lastCheckRating")}
              value={lastCheckOn ?? ""}
              onChange={setLastCheckOn}
              quick={["today"]}
            />
          ) : null}
          {form.validity === true || validUntil ? (
            <Field
              label={t("docs.alertDays")}
              value={alertDays}
              onChangeText={setAlertDays}
              monoValue
              keyboardType="numbers-and-punctuation"
            />
          ) : null}
          <Row>
            <Badge
              text={statusLabel(t, status)}
              color={statusColor(c, status.state)}
            />
          </Row>
        </Card>
        <Card>
          <Field
            label={t("docs.notes")}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Card>
        {error ? <Txt color={c.warning}>{t("docs.invalid")}</Txt> : null}
        <Button title={t("common.save")} onPress={save} />
        {existing ? (
          <Button kind="danger" title={t("common.delete")} onPress={del} />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
