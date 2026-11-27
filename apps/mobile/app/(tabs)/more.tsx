import { getSyncStatus } from "../../src/syncStatus";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { PILOT_FUNCTIONS, REGULATORS, frameworkOf, regulatorById, type IfrDefault, type Locale, type PilotFunction, type TimeDisplay } from "@cielo/core";
import { Button, Card, Chip, Field, MenuGroup, MenuRow, Row, Screen, Segmented, ToggleRow, Txt } from "../../src/components/ui";
import { WIDGETS_IN_BUILD, liveActivityEnabled, setLiveActivityEnabled } from "../../src/widgets/sync";
import { useCrewInbox } from "../../src/crew";
import { runningVersion } from "../../src/updates";
import { layoutForAuthority } from "@cielo/export";
import Ionicons from "@expo/vector-icons/Ionicons";
import { exportAllDataJson, exportLogbookCsv, exportLogbookPdf, exportLogbookXlsx } from "../../src/exporters";
import { signaturesFor } from "../../src/signing";
import { isCloudEnabled } from "../../src/auth";
import { sendReport } from "../../src/api";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";
import { loadThemePref, setThemePref, type ThemePref } from "../../src/appearance";
import { AppearancePicker } from "../../src/components/AppearancePicker";

export default function More() {
  const app = useApp();
  const { t, pilot, flights, balances, store, session } = app;
  const c = useTheme();

  const [busy, setBusy] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePref>(loadThemePref);
  const [live, setLive] = useState(liveActivityEnabled);
  const crewInbox = useCrewInbox();

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

  /**
   * The PDF: the pilot is offered to sign the logbook (their saved signature and the date in each page's
   * certification); without a saved signature, to draw one first. The flights' signatures always go with it.
   */
  const exportPdf = () => {
    const go = (holderSigns: boolean) => run("pdf", async () => exportLogbookPdf(flights, balances, pilot, { signatures: await signaturesFor(app.store, flights), holderSigns }));
    if (!app.access.has("signature")) return void go(false);
    if (!pilot.signatureDataUrl)
      return Alert.alert(t("mysig.exportTitle"), t("mysig.exportNone"), [
        { text: t("mysig.create"), onPress: () => router.push("/profile") },
        { text: t("mysig.exportUnsigned"), onPress: () => void go(false) },
        { text: t("common.cancel"), style: "cancel" },
      ]);
    Alert.alert(t("mysig.exportTitle"), t("mysig.exportBody", { name: pilot.fullName }), [
      { text: t("mysig.exportSigned"), onPress: () => void go(true) },
      { text: t("mysig.exportUnsigned"), onPress: () => void go(false) },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  // signing out clears the phone: say so, and warn when changes have not reached the server yet
  const confirmSignOut = () => {
    const pending = getSyncStatus().pending;
    Alert.alert(t("more.signOut"), pending ? t("more.signOutPending", { n: pending }) : t("more.signOutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("more.signOut"), style: pending ? "destructive" : "default", onPress: () => void run("signout", () => app.signOut()) },
    ]);
  };

  const confirmWipe = () =>
    Alert.alert(t("more.deleteAllTitle"), t("more.deleteAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () =>
          void run("wipe", async () => {
            // the pilot asked to erase this device: no copy kept here (the account keeps what reached the server)
            await app.signOut({ forget: true });
            await app.wipeAll();
          }),
      },
    ]);

  const [report, setReport] = useState("");
  const [reportKind, setReportKind] = useState<"bug" | "idea">("bug");
  const send = () =>
    run("report", async () => {
      await sendReport(reportKind, report.trim(), Platform.OS === "android" ? "android" : "ios", Constants.expoConfig?.version ?? "0", session?.access_token);
      setReport("");
      Alert.alert(t("report.title"), t("report.thanks"));
    });

  return (
    <Screen columns>
      <MenuGroup title={t("more.g.pilot")}>
        <MenuRow icon={<Ionicons name="person" size={17} color="#fff" />} color="#0A84FF" label={t("more.openProfile")} onPress={() => router.navigate("/profile")} />
        <MenuRow icon={<Ionicons name="ribbon" size={17} color="#fff" />} color="#FF9F0A" label={t("more.documents")} onPress={() => router.navigate("/documents")} />
        <MenuRow icon={<Ionicons name="create-outline" size={17} color="#fff" />} color="#64D2FF" label={t("more.endorsements")} onPress={() => router.push("/endorsements")} />
        <MenuRow icon={<Ionicons name="create" size={17} color="#fff" />} color="#30B0C7" label={t("crew.menu")} value={crewInbox ? String(crewInbox) : undefined} onPress={() => router.navigate("/crew")} />
        <MenuRow icon={<Ionicons name="notifications" size={17} color="#fff" />} color="#FF3B30" label={t("more.reminders")} onPress={() => router.navigate("/reminders")} />
      </MenuGroup>

      {/* Activity (roster, FTL, layovers, time zones, radar, map) and Career (experience, goals, jobs, CV) have their own tabs */}
      <MenuGroup title={t("more.g.logbook")}>
        <MenuRow icon={<Ionicons name="download" size={17} color="#fff" />} color="#22C55E" label={t("uimp.title")} value={t("more.importKinds")} onPress={() => router.push("/import" as never)} />
        <MenuRow icon={<Ionicons name="airplane" size={17} color="#fff" />} color="#5E5CE6" label={t("more.aircraft")} onPress={() => router.navigate("/aircraft")} />
        <MenuRow icon={<Ionicons name="funnel" size={17} color="#fff" />} color="#0A84FF" label={t("more.reports")} onPress={() => router.navigate("/reports")} />
        <MenuRow icon={<Ionicons name="checkmark-done" size={17} color="#fff" />} color="#34C759" label={t("more.audit")} onPress={() => router.navigate("/audit")} />
        <MenuRow icon={<Ionicons name="albums" size={17} color="#fff" />} color="#BF5AF2" label={t("more.opening")} onPress={() => router.navigate("/opening")} />
        <MenuRow icon={<Ionicons name="document-text" size={17} color="#fff" />} color="#5856D6" label={t("more.r8710")} onPress={() => router.push("/report8710")} />
      </MenuGroup>



      <Card>
        <Txt variant="label">{t("more.authority")}</Txt>
        {/* the authority sets the rule family (logbook layout, recency rules) the app applies */}
        <Row style={{ flexWrap: "wrap" }}>
          {REGULATORS.map((r) => (
            <Chip
              key={r.id}
              label={r.id === "ANAC_BR" ? "ANAC Brasil" : r.id === "ANAC_AR" ? "ANAC Argentina" : r.short}
              selected={(pilot.authority ?? pilot.regulatoryFramework) === r.id}
              onPress={() => void app.savePilot({ authority: r.id, regulatoryFramework: r.framework })}
            />
          ))}
        </Row>
        <Txt variant="small">
          {(() => {
            const r = regulatorById(pilot.authority ?? pilot.regulatoryFramework);
            return r ? `${r.name} · ${r.basis}` : "";
          })()}
        </Txt>
        <Segmented<"always" | "alternate" | "never">
          label={t("more.defaultPf")}
          value={pilot.defaultPilotFlying ?? "alternate"}
          onChange={(v) => void app.savePilot({ defaultPilotFlying: v })}
          options={[
            { value: "always", label: t("more.pf.always") },
            { value: "alternate", label: t("more.pf.alternate") },
            { value: "never", label: t("more.pf.never") },
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
        <Segmented<ThemePref>
          label={t("more.theme")}
          value={theme}
          onChange={(v) => {
            setTheme(v);
            setThemePref(v);
          }}
          options={[
            { value: "dark", label: t("more.theme.dark") },
            { value: "light", label: t("more.theme.light") },
            { value: "system", label: t("more.theme.system") },
          ]}
        />
        <AppearancePicker theme={theme} onTheme={setTheme} />
        {Platform.OS === "ios" && WIDGETS_IN_BUILD ? (
          <ToggleRow
            label={t("more.liveActivity")}
            hint={t("more.liveActivityHint")}
            value={live}
            onChange={(v) => {
              setLive(v);
              setLiveActivityEnabled(v);
            }}
          />
        ) : null}
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
        <Txt variant="small">{t("more.exportAlways")}</Txt>
        <Button
          kind="secondary"
          title={busy === "pdf" ? t("more.exporting") : t("more.exportPdf", { layout: layoutForAuthority(pilot.authority, frameworkOf(pilot)).replace("TCCA", "Transport Canada").replace("HKCAD", "CAD Hong Kong").replace("UK", "UK CAA") })}
          loading={busy === "pdf"}
          onPress={exportPdf}
        />
        <Button
          kind="secondary"
          title={t("more.exportCsv")}
          loading={busy === "csv"}
          onPress={() => run("csv", async () => exportLogbookCsv(flights, pilot, { signatures: await signaturesFor(app.store, flights) }))}
        />
        <Button
          kind="secondary"
          title={t("more.exportXlsx")}
          loading={busy === "xlsx"}
          onPress={() => run("xlsx", async () => exportLogbookXlsx(flights, pilot, { signatures: await signaturesFor(app.store, flights) }))}
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
            <Button title={t("account.open")} onPress={() => router.push("/account")} />
            <Button kind="secondary" title={t("more.signOut")} onPress={confirmSignOut} />
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
        <Txt variant="h2">{t("report.title")}</Txt>
        <Segmented<"bug" | "idea">
          value={reportKind}
          onChange={setReportKind}
          options={[
            { value: "bug", label: t("report.bug") },
            { value: "idea", label: t("report.idea") },
          ]}
        />
        <Field value={report} onChangeText={setReport} multiline placeholder={t("report.placeholder")} maxLength={4000} />
        <Txt variant="small">{t("report.context")}</Txt>
        <Button title={t("report.send")} disabled={!report.trim()} loading={busy === "report"} onPress={send} />
      </Card>

      <Card>
        <Txt variant="h2">{t("more.privacy")}</Txt>
        <Button kind="secondary" title={t("more.exportJson")} loading={busy === "json"} onPress={() => run("json", () => exportAllDataJson(store))} />
        <Button kind="danger" title={t("more.deleteAll")} loading={busy === "wipe"} onPress={confirmWipe} />
      </Card>

      <MenuGroup title={t("more.g.follow")}>
        <MenuRow icon={<Ionicons name="logo-linkedin" size={17} color="#fff" />} color="#0A66C2" label="LinkedIn" onPress={() => void Linking.openURL("https://www.linkedin.com/company/geardown/")} />
        <MenuRow icon={<Ionicons name="logo-instagram" size={17} color="#fff" />} color="#E1306C" label="Instagram" onPress={() => void Linking.openURL("https://www.instagram.com/geardown_app/")} />
      </MenuGroup>

      <Txt variant="small" style={{ textAlign: "center" }} color={c.muted}>
        Geardown · {t("more.version", { v: Constants.expoConfig?.version ?? "0.0.0" })}
        {"\n"}
        {runningVersion()}
      </Txt>
    </Screen>
  );
}
