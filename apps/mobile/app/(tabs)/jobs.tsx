import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import Ionicons from "@expo/vector-icons/Ionicons";
import { buildProfile, detectAircraft, matchJob, type Job, type Position } from "@cielo/jobs";
import { Card, Chip, Row, Screen, Segmented, ToggleRow, Txt } from "../../src/components/ui";
import { Requires } from "../../src/components/Access";
import { api } from "../../src/api";
import { formatDate, type I18nKey } from "../../src/i18n";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

type Sort = "match" | "recent" | "salary";

export default function JobsScreen() {
  return (
    <Requires feature="jobs">
      <Jobs />
    </Requires>
  );
}

function Jobs() {
  const { t, locale, flights, balances, licenses, aircraftTypes, pilot } = useApp();
  const c = useTheme();
  const [feed, setFeed] = useState<{ jobs: Job[] } | null | undefined>(undefined);
  const [sort, setSort] = useState<Sort>("match");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [onType, setOnType] = useState(false);
  const [mine, setMine] = useState(true);

  useEffect(() => {
    api<{ jobs: Job[] }>("/api/jobs").then(setFeed).catch(() => setFeed(null));
  }, []);

  // the match is computed here, from the logbook on the phone: nothing is sent
  const profile = useMemo(() => {
    const engine = new Map(aircraftTypes.map((x) => [x.icao, x.engineType]));
    return buildProfile(flights, balances, licenses, (i) => engine.get(i), (code) => detectAircraft(code), { framework: pilot.regulatoryFramework });
  }, [flights, balances, licenses, aircraftTypes, pilot.regulatoryFramework]);
  const hasLogbook = profile.totalMin > 0;

  const rows = useMemo(() => {
    let list = (feed?.jobs ?? []).map((job) => ({ job, match: matchJob(job, profile) }));
    if (position !== "ALL") list = list.filter((r) => r.job.position === position);
    if (onType) list = list.filter((r) => r.match.onType);
    if (mine && profile.workRegions.length) list = list.filter((r) => (r.match.canWork && r.match.licenceValid) || r.job.region === "OTHER");
    const sal = (j: Job) => j.salary?.annualEur ?? -1;
    list.sort((a, b) =>
      sort === "match" && hasLogbook
        ? b.match.score - a.match.score || b.match.confidence - a.match.confidence
        : sort === "salary"
          ? sal(b.job) - sal(a.job)
          : (b.job.postedAt ?? "").localeCompare(a.job.postedAt ?? ""),
    );
    return list;
  }, [feed, profile, position, onType, mine, sort, hasLogbook]);
  const positions = useMemo(() => [...new Set((feed?.jobs ?? []).map((j) => j.position))] as Position[], [feed]);

  const scoreColor = (s: number) => (s >= 85 ? c.success : s >= 60 ? c.accent : c.caution);
  const salary = (j: Job) => {
    const s = j.salary;
    if (!s) return "";
    const f = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency: s.currency, maximumFractionDigits: 0 }).format(n);
    return `${[s.min, s.max].filter((x): x is number => x != null).map(f).join("–")} ${t(`jobs.per.${s.period}` as I18nKey)}`;
  };

  return (
    <Screen>
      <Txt variant="small">{t("jobs.privacy")}</Txt>
      {!hasLogbook ? <Txt variant="muted">{t("jobs.noLogbook")}</Txt> : null}
      <Segmented<Sort>
        value={sort}
        onChange={setSort}
        options={(["match", "recent", "salary"] as Sort[]).filter((s) => hasLogbook || s !== "match").map((s) => ({ value: s, label: t(`jobs.sort.${s}` as I18nKey) }))}
      />
      <Row style={{ flexWrap: "wrap" }} gap={6}>
        <Chip label={t("jobs.all")} selected={position === "ALL"} onPress={() => setPosition("ALL")} />
        {positions.map((p) => (
          <Chip key={p} label={t(`jobs.pos.${p}` as I18nKey)} selected={position === p} onPress={() => setPosition(p)} />
        ))}
      </Row>
      <ToggleRow label={t("jobs.onType")} value={onType} onChange={setOnType} />
      <ToggleRow label={t("jobs.myRegions")} value={mine} onChange={setMine} hint={profile.workRegions.join(" · ")} />

      {feed === undefined ? <ActivityIndicator color={c.accent} /> : null}
      {feed === null ? <Txt color={c.warning}>{t("jobs.error")}</Txt> : null}
      {feed && rows.length === 0 ? <Txt variant="muted">{t("jobs.empty")}</Txt> : null}
      {rows.slice(0, 80).map(({ job, match }, i) => (
        <Card key={`${job.id}-${i}`} onPress={() => void WebBrowser.openBrowserAsync(job.url)}>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="small" style={{ fontWeight: "700" }}>{job.company}</Txt>
              <Txt style={{ fontWeight: "600" }}>{job.title}</Txt>
              <Txt variant="small">
                {[t(`jobs.pos.${job.position}` as I18nKey), job.location, job.aircraft.join(", ")].filter(Boolean).join(" · ")}
              </Txt>
            </View>
            {hasLogbook ? (
              <View style={{ alignItems: "center" }}>
                <Txt mono style={{ fontSize: 20, fontWeight: "800" }} color={scoreColor(match.score)}>{match.score}%</Txt>
                <Txt variant="small">{t("jobs.match")}</Txt>
              </View>
            ) : null}
          </Row>
          {hasLogbook && match.gaps.length ? (
            <Txt variant="small" color={c.caution}>
              {t("jobs.gaps")} : {match.gaps.map((g) => `${t(`jobs.req.${g.code}` as I18nKey)} ${g.required}${typeof g.have === "number" ? ` (${g.have})` : ""}`).join(" · ")}
            </Txt>
          ) : null}
          {job.source === "adzuna" ? (
            <Pressable onPress={() => void WebBrowser.openBrowserAsync("https://www.adzuna.com")}>
              <Txt variant="small" style={{ textDecorationLine: "underline" }}>Jobs by Adzuna</Txt>
            </Pressable>
          ) : null}
          <Row style={{ justifyContent: "space-between" }}>
            <Txt variant="small" mono>{salary(job)}</Txt>
            <Pressable onPress={() => void WebBrowser.openBrowserAsync(job.url)}>
              <Row gap={4}>
                <Txt variant="small" color={c.accent}>
                  {job.postedAt ? `${formatDate(job.postedAt.slice(0, 10), locale)} · ` : ""}
                  {t("jobs.apply")}
                </Txt>
                <Ionicons name="open-outline" size={13} color={c.accent} />
              </Row>
            </Pressable>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
