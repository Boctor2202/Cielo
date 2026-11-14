import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { PILOT_FUNCTIONS, type IfrDefault, type Locale, type PilotFunction, type RegulatoryFramework, type TimeDisplay } from "@cielo/core";
import { Button, Card, Chip, Field, Row, Screen, Segmented, Txt } from "../../src/components/ui";
import { exportAllDataJson, exportLogbookCsv, exportLogbookPdf } from "../../src/exporters";
import { isCloudEnabled } from "../../src/auth";
import { pickAndImportCsv } from "../../src/importer";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

export default function More() {
  const app = useApp();
  const { t, pilot, flights, balances, store, session } = app;
  const c = useTheme();

  const [fullName, setFullName] = useState(pilot.fullName);
  const [licenceNumber, setLicenceNumber] = useState(pilot.licenceNumber ?? "");
  const [homeBase, setHomeBase] = useState(pilot.homeBaseIcao ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(pilot.fullName);
    setLicenceNumber(pilot.licenceNumber ?? "");
    setHomeBase(pilot.homeBaseIcao ?? "");
  }, [pilot.id, pilot.fullName, pilot.licenceNumber, pilot.homeBaseIcao]);

  const saveProfile = async () => {
    await app.savePilot({
      fullName: fullName.trim(),
      licenceNumber: licenceNumber.trim() || undefined,
      homeBaseIcao: homeBase.trim().toUpperCase() || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmWipe = () =>
    Alert.alert(t("more.deleteAllTitle"), t("more.deleteAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () =>
          void run("wipe", async () => {
            await app.signOut();
            await app.wipeAll();
          }),
      },
    ]);

  const importCsv = () =>
    run("import", async () => {
      const r = await pickAndImportCsv(store, pilot, app.aircraftTypes, flights);
      if (!r) return;
      await app.reload();
      Alert.alert(t("more.import"), r.imported || r.duplicates ? t("more.importDone", { n: r.imported, d: r.duplicates, s: r.skipped }) : t("more.importEmpty"));
    });

  return (
    <Screen>
      <Card>
        <Txt variant="h2">{t("more.shortcuts")}</Txt>
        <Button kind="secondary" title={t("more.roster")} onPress={() => router.push("/roster")} />
        <Button kind="secondary" title={t("more.documents")} onPress={() => router.push("/documents")} />
        <Button kind="secondary" title={t("more.import")} loading={busy === "import"} onPress={importCsv} />
        <Txt variant="small">{t("more.importHint")}</Txt>
      </Card>

      <Card>
        <Txt variant="h2">{t("more.profile")}</Txt>
        <Field label={t("more.fullName")} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <Field label={t("more.licenceNumber")} value={licenceNumber} onChangeText={setLicenceNumber} monoValue autoCapitalize="characters" />
        <Field label={t("more.homeBase")} value={homeBase} onChangeText={setHomeBase} monoValue autoCapitalize="characters" maxLength={4} />
        <Button title={saved ? t("more.saved") : t("common.save")} onPress={saveProfile} />
      </Card>

      <Card>
        <Segmented<RegulatoryFramework>
          label={t("more.framework")}
          value={pilot.regulatoryFramework}
          onChange={(v) => void app.savePilot({ regulatoryFramework: v })}
          options={[
            { value: "EASA", label: "EASA" },
            { value: "FAA", label: "FAA" },
            { value: "CASA", label: "CASA" },
          ]}
        />
        <Segmented<IfrDefault>
          label={t("more.defaultIfr")}
          value={pilot.defaultIfr}
          onChange={(v) => void app.savePilot({ defaultIfr: v })}
          options={[
            { value: "never", label: t("more.ifr.never") },
            { value: "always", label: t("more.ifr.always") },
            { value: "ask", label: t("more.ifr.ask") },
          ]}
        />
        <Txt variant="label">{t("more.defaultFunction")}</Txt>
        <Row style={{ flexWrap: "wrap" }}>
          {PILOT_FUNCTIONS.map((f: PilotFunction) => (
            <Chip key={f} label={f} selected={pilot.defaultFunction === f} onPress={() => void app.savePilot({ defaultFunction: f })} />
          ))}
        </Row>
        <Segmented<TimeDisplay>
          label={t("more.timeDisplay")}
          value={pilot.timeDisplay}
          onChange={(v) => void app.savePilot({ timeDisplay: v })}
          options={[
            { value: "hhmm", label: t("more.time.hhmm") },
            { value: "decimal", label: t("more.time.decimal") },
          ]}
        />
        <Segmented<Locale>
          label={t("more.language")}
          value={pilot.locale}
          onChange={(v) => void app.savePilot({ locale: v })}
          options={[
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
          ]}
        />
      </Card>

      <Card>
        <Txt variant="h2">{t("more.export")}</Txt>
        <Button
          kind="secondary"
          title={busy === "pdf" ? t("more.exporting") : t("more.exportPdf", { layout: pilot.regulatoryFramework })}
          loading={busy === "pdf"}
          onPress={() => run("pdf", () => exportLogbookPdf(flights, balances, pilot))}
        />
        <Button
          kind="secondary"
          title={t("more.exportCsv")}
          loading={busy === "csv"}
          onPress={() => run("csv", () => exportLogbookCsv(flights, pilot))}
        />
      </Card>

      <Card>
        <Txt variant="h2">{t("more.account")}</Txt>
        {!isCloudEnabled ? (
          <>
            <Txt>{t("more.localMode")}</Txt>
            <Txt variant="small">{t("more.localModeHint")}</Txt>
          </>
        ) : session ? (
          <>
            <Txt>{t("more.signedInAs", { email: session.user.email ?? session.user.id })}</Txt>
            <Button kind="secondary" title={t("more.signOut")} onPress={() => void app.signOut()} />
          </>
        ) : (
          <>
            <Txt variant="muted">{t("more.localMode")}</Txt>
            <Button title={t("more.signIn")} onPress={() => router.push("/auth")} />
          </>
        )}
        <Button kind="ghost" title={t("more.subscription")} onPress={() => router.push("/subscription")} />
      </Card>

      <Card>
        <Txt variant="h2">{t("more.privacy")}</Txt>
        <Button kind="secondary" title={t("more.exportJson")} loading={busy === "json"} onPress={() => run("json", () => exportAllDataJson(store))} />
        <Button kind="danger" title={t("more.deleteAll")} loading={busy === "wipe"} onPress={confirmWipe} />
      </Card>

      <Txt variant="small" style={{ textAlign: "center" }} color={c.muted}>
        Geardown · {t("more.version", { v: Constants.expoConfig?.version ?? "0.0.0" })}
      </Txt>
    </Screen>
  );
}
