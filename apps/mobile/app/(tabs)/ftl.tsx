import React, { useMemo, useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FTL_LIMITS, analyseFtl, buildDutyPeriods, cumulativeLevel, formatDuration, limitApplies, type FtlRegime } from "@cielo/core";
import { Card, Chip, Field, Row, Screen, Segmented, Txt, statusColor } from "../../src/components/ui";
import { Track } from "../../src/components/Bars";
import { Requires } from "../../src/components/Access";
import { AirportField } from "../../src/components/AirportField";
import { formatDate, type I18nKey } from "../../src/i18n";
import { useApp } from "../../src/state";
import { lookupAirport } from "../../src/airports";
import { autoTimezone, saveFtlPrefs, timeZones, useFtlSettings } from "../../src/ftlSettings";
import { space, useTheme } from "../../src/theme";

const KEYS = ["duty7d", "duty14d", "duty28d", "flight28d", "flightYear", "flight12m"] as const;

export default function FtlScreen() {
  return (
    <Requires feature="ftl">
      <Ftl />
    </Requires>
  );
}

function Ftl() {
  const app = useApp();
  const { t, locale, flights, pilot } = app;
  const c = useTheme();
  const f = (m: number) => formatDuration(m);
  const { settings, prefs } = useFtlSettings();
  const report = useMemo(() => analyseFtl(buildDutyPeriods(flights, settings), new Date().toISOString(), settings), [flights, settings]);
  const duties = report.duties.slice(-20).reverse();
  const hm = (iso: string) => iso.slice(11, 16);

  return (
    <Screen>
      <Card>
        <Txt variant="h2">{t("dash.ftl")}</Txt>
        {KEYS.filter((k) => limitApplies(k, settings.regime)).map((k) => {
          const actual = report.cumulative[k];
          const limit = FTL_LIMITS[k];
          const level = cumulativeLevel(actual, limit);
          return (
            <View key={k} style={{ gap: 4 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt variant="muted">{t(`dash.ftl.${k}` as I18nKey)}</Txt>
                <Txt mono variant="small" color={statusColor(c, level)}>{f(actual)} / {f(limit)}</Txt>
              </Row>
              <Track ratio={limit ? actual / limit : 0} color={statusColor(c, level)} />
            </View>
          );
        })}
      </Card>

      <Card>
        <Txt variant="h2">{t("ftl.violations", { n: report.violations.length })}</Txt>
        {report.violations.length === 0 ? <Txt color={c.success}>{t("ftl.none")}</Txt> : null}
        {report.violations.slice(0, 20).map((v, i) => (
          <Row key={i} style={{ alignItems: "flex-start" }}>
            <Ionicons name="alert-circle-outline" size={18} color={v.severity === "warning" ? c.caution : c.warning} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Txt>{t(`ftl.code.${v.code}` as I18nKey, { actual: f(v.actualMin), limit: f(v.limitMin) })}</Txt>
              <Txt variant="small" mono>
                {formatDate(v.atUtc.slice(0, 10), locale)} · {hm(v.atUtc)} UTC{v.severity === "warning" && v.code === "fdpExceeded" ? ` · ${t("ftl.withinExtension")}` : ""}
              </Txt>
            </View>
          </Row>
        ))}
      </Card>

      <Card>
        <Txt variant="h2">{t("ftl.duties")}</Txt>
        {duties.length === 0 ? <Txt variant="muted">{t("dash.noFlights")}</Txt> : null}
        {duties.map((a) => {
          const over = a.fdpMin > a.maxFdpMin;
          const restShort = a.restBeforeMin !== undefined && a.minRestBeforeMin !== undefined && a.restBeforeMin < a.minRestBeforeMin;
          return (
            <View key={a.duty.id} style={{ gap: 2, paddingVertical: 2 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt mono numberOfLines={1} style={{ flex: 1 }}>
                  {formatDate(a.duty.reportUtc.slice(0, 10), locale)} · {a.duty.startIcao}→{a.duty.endIcao}
                </Txt>
                <Txt mono variant="small" color={over ? c.warning : c.text}>
                  {f(a.fdpMin)} / {Number.isFinite(a.maxFdpMin) ? f(a.maxFdpMin) : "—"}
                </Txt>
              </Row>
              <Txt variant="small" mono color={restShort ? c.warning : c.muted}>
                {t("ftl.sectors", { n: a.duty.sectors })}
                {a.splitExtensionMin ? ` · ${t("ftl.split", { m: f(a.splitExtensionMin) })}` : ""}
                {a.restBeforeMin !== undefined ? ` · ${t("ftl.rest", { r: f(a.restBeforeMin), min: f(a.minRestBeforeMin ?? 0) })}` : ""}
              </Txt>
            </View>
          );
        })}
      </Card>

      <Card>
        <Txt variant="h2">{t("ftl.settings")}</Txt>
        <Segmented<FtlRegime>
          label={t("ftl.regime")}
          value={pilot.ftlRegime ?? "oro"}
          onChange={(v) => void app.savePilot({ ftlRegime: v })}
          options={[
            { value: "oro", label: "ORO.FTL" },
            { value: "subq", label: "Subpart Q" },
            { value: "none", label: t("ftl.regimeNone") },
          ]}
        />
        <Txt variant="small">{t(`ftl.regimeHint.${pilot.ftlRegime ?? "oro"}` as I18nKey)}</Txt>
        <Row style={{ alignItems: "flex-start" }}>
          <MinutesField style={{ flex: 1 }} label={t("ftl.reportBefore")} value={settings.reportBeforeMin} max={180} onChange={(v) => void saveFtlPrefs(app, { reportBeforeMin: v })} />
          <MinutesField style={{ flex: 1 }} label={t("ftl.releaseAfter")} value={settings.releaseAfterMin} max={120} onChange={(v) => void saveFtlPrefs(app, { releaseAfterMin: v })} />
        </Row>
        <AirportField
          label={t("more.homeBase")}
          value={pilot.homeBaseIcao ?? ""}
          onChange={(icao) => {
            void app.savePilot({ homeBaseIcao: icao || undefined });
            // as on the web, a new base brings its time zone: the reference time follows it again
            if (icao && lookupAirport(icao)?.timezone && prefs.homeTimezone) void saveFtlPrefs(app, { homeTimezone: undefined });
          }}
        />
        <TimeZonePicker value={settings.homeTimezone} chosen={prefs.homeTimezone} auto={autoTimezone(pilot)} onChange={(tz) => void saveFtlPrefs(app, { homeTimezone: tz })} />
        <Txt variant="small">{t("ftl.assumptions", { report: settings.reportBeforeMin, release: settings.releaseAfterMin, tz: settings.homeTimezone })}</Txt>
        <Txt variant="small">{t("ftl.settingsLocal")}</Txt>
      </Card>
      <Txt variant="small" style={{ paddingHorizontal: space.sm }}>{t("ftl.disclaimer")}</Txt>
    </Screen>
  );
}

/** Whole minutes on the number pad, saved as typed (0 to max, as the web field). */
function MinutesField({ label, value, max, onChange, style }: { label: string; value: number; max: number; onChange: (v: number) => void; style?: StyleProp<ViewStyle> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const n = draft === null ? value : Number(draft);
  const bad = draft !== null && (draft === "" || n > max);
  return (
    <Field
      style={style}
      label={label}
      value={draft ?? String(value)}
      keyboardType="number-pad"
      maxLength={3}
      monoValue
      error={bad}
      onChangeText={(s) => {
        const d = s.replace(/\D/g, "");
        setDraft(d);
        if (d !== "" && Number(d) <= max) onChange(Number(d));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** Reference time zone: follows the home base unless the pilot picks one from the searchable IANA list. */
function TimeZonePicker({ value, chosen, auto, onChange }: { value: string; chosen?: string; auto: string; onChange: (tz: string | undefined) => void }) {
  const { t } = useApp();
  const c = useTheme();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, "_");
    if (s.length < 2) return [];
    return timeZones().filter((z) => z.toLowerCase().includes(s)).slice(0, 8);
  }, [q]);
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label">{t("ftl.timezone")}</Txt>
      <Row style={{ flexWrap: "wrap" }} gap={6}>
        <Chip label={t("ftl.tzAuto", { tz: auto })} selected={!chosen} onPress={() => onChange(undefined)} />
        {chosen ? <Chip label={chosen} selected onPress={() => undefined} /> : null}
        {chosen !== "UTC" ? <Chip label="UTC" onPress={() => onChange("UTC")} /> : null}
      </Row>
      <Field placeholder={t("ftl.tzSearch")} value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} />
      {q.trim().length >= 2 && hits.length === 0 ? <Txt variant="muted">{t("ftl.tzNone")}</Txt> : null}
      {hits.map((z) => (
        <Pressable
          key={z}
          accessibilityRole="button"
          onPress={() => {
            onChange(z);
            setQ("");
          }}
          style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <Txt mono>{z.replace(/_/g, " ")}</Txt>
            {z === value ? <Ionicons name="checkmark" size={16} color={c.accent} /> : null}
          </Row>
        </Pressable>
      ))}
    </View>
  );
}
