import { Achievements } from "../../src/components/Achievements";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Flag } from "../../src/components/Flag";
import { countryName, distanceNm, formatDuration, groupTotals, sumFlights, type Flight } from "@cielo/core";
import { Card, Row, Screen, Segmented, Stat, Txt, tap } from "../../src/components/ui";
import { BarRow } from "../../src/components/Bars";
import { lookupAirport } from "../../src/airports";
import { todayUtc, useApp } from "../../src/state";
import { glass, space, useTheme } from "../../src/theme";

type Range = "all" | "y" | "m12";

export default function Stats() {
  const { t, flights, pilot, locale, balances } = useApp();
  const [range, setRange] = useState<Range>("all");
  const [open, setOpen] = useState<"airports" | "countries" | null>(null);
  const c = useTheme();
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);
  const today = todayUtc();

  const s = useMemo(() => {
    const from = range === "y" ? `${today.slice(0, 4)}-01-01` : range === "m12" ? new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10) : "";
    const list = flights.filter((f) => !f.deletedAt && f.date >= from);
    const real = list.filter((f) => !f.isFstd);
    const totals = sumFlights(list);
    let nm = 0;
    let longest = { nm: 0, label: "—", id: "" };
    const byCountry = new Map<string, { airports: Set<string>; moves: number }>();
    for (const f of real) {
      const a = lookupAirport(f.depIcao);
      const b = lookupAirport(f.arrIcao);
      for (const ap of [a, b]) {
        if (!ap?.country) continue;
        const e = byCountry.get(ap.country) ?? { airports: new Set<string>(), moves: 0 };
        e.airports.add(ap.icao);
        e.moves++;
        byCountry.set(ap.country, e);
      }
      if (a && b) {
        const d = distanceNm(a, b);
        nm += d;
        if (d > longest.nm) longest = { nm: d, label: `${f.depIcao} → ${f.arrIcao}`, id: f.id };
      }
    }
    const fn = (["picMin", "copilotMin", "dualMin", "instructorMin"] as const).map((k) => ({ key: k, minutes: list.reduce((x, f: Flight) => x + (f[k] ?? 0), 0) }));
    return {
      totals,
      nm: Math.round(nm),
      airports: new Set(real.flatMap((f) => [f.depIcao, f.arrIcao])).size,
      longest,
      allAirports: groupTotals(real, "airport").sort((a, b) => b.flights - a.flights),
      countries: [...byCountry.entries()].map(([code, e]) => ({ code, airports: [...e.airports].sort(), moves: e.moves })).sort((a, b) => b.moves - a.moves),
      byYear: groupTotals(list, "year").sort((a, b) => b.key.localeCompare(a.key)).slice(0, 8),
      byType: groupTotals(list, "aircraftTypeIcao").slice(0, 8),
      topAirports: groupTotals(real, "airport").sort((a, b) => b.flights - a.flights).slice(0, 8),
      regs: groupTotals(real, "registration").slice(0, 6),
      fn: fn.filter((x) => x.minutes > 0),
    };
  }, [flights, range, today]);

  const max = (rows: { minutes: number }[]) => Math.max(1, ...rows.map((r) => r.minutes));
  const section = (title: string, rows: { key: string; minutes: number; flights: number }[], byFlights = false) =>
    rows.length ? (
      <Card>
        <Txt variant="h2">{title}</Txt>
        {rows.map((r) => (
          <BarRow
            key={r.key}
            label={r.key}
            value={byFlights ? t("dash.flights", { n: r.flights }) : fmt(r.minutes)}
            ratio={byFlights ? r.flights / Math.max(1, ...rows.map((x) => x.flights)) : r.minutes / max(rows)}
          />
        ))}
      </Card>
    ) : null;

  return (
    <Screen columns>
      <Achievements flights={flights} opening={balances} t={t} locale={locale} />
      <Segmented<Range>
        value={range}
        onChange={setRange}
        options={[
          { value: "all", label: t("stats.all") },
          { value: "y", label: today.slice(0, 4) },
          { value: "m12", label: t("dash.m12") },
        ]}
      />
      <Card>
        <Row gap={space.md}>
          <Stat label={t("stats.hours")} value={fmt(s.totals.totalMin)} sub={t("dash.flights", { n: s.totals.flights })} />
          <Stat label={t("stats.distance")} value={`${s.nm.toLocaleString()} NM`} sub={t("stats.airportsCount", { n: s.airports })} />
        </Row>
        <Row gap={space.md}>
          <Stat label={t("dash.night")} value={fmt(s.totals.nightMin)} />
          <Stat label={t("dash.ifr")} value={fmt(s.totals.ifrMin)} />
          <Stat label={t("dash.landings")} value={String(s.totals.landingsDay + s.totals.landingsNight)} />
        </Row>
      </Card>
      {/* what the figures count, one tap away (as on the website) */}
      <Card>
        <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
          <Tile
            label={t("stats.distance")}
            value={`${s.nm.toLocaleString(locale)} NM`}
            sub={s.nm ? `🌍 ${t("stats.earthLaps", { n: (s.nm / EARTH_NM).toLocaleString(locale, { maximumFractionDigits: 1 }) })}` : undefined}
            onPress={() => router.navigate("/map")}
          />
          <Tile label={t("stats.airportsTile")} value={String(s.airports)} onPress={() => setOpen("airports")} />
          <Tile label={t("stats.countriesTile")} value={String(s.countries.length)} onPress={() => setOpen("countries")} />
          <Tile
            label={t("stats.longest")}
            value={`${Math.round(s.longest.nm).toLocaleString(locale)} NM`}
            sub={s.longest.label}
            onPress={s.longest.id ? () => router.push({ pathname: "/flight/[id]", params: { id: s.longest.id } }) : undefined}
          />
        </Row>
      </Card>
      <Modal visible={open !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center", padding: space.lg }}>
            <Txt variant="h2">{open === "countries" ? t("stats.countriesTile") : t("stats.airportsTile")}</Txt>
            <Pressable onPress={() => setOpen(null)} hitSlop={10}>
              <Ionicons name="close" size={24} color={c.muted} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 40, gap: 2 }}>
            {open === "countries"
              ? s.countries.map((x) => (
                  <Row key={x.code} style={{ alignItems: "center", paddingVertical: 8 }} gap={10}>
                    <Flag code={x.code} size={22} />
                    <View style={{ flex: 1 }}>
                      <Txt style={{ fontWeight: "600" }}>{countryName(x.code, locale) ?? x.code}</Txt>
                      <Txt variant="small" mono numberOfLines={1}>{x.airports.join(" · ")}</Txt>
                    </View>
                    <Txt variant="small" mono>{t("stats.moves", { n: x.moves })}</Txt>
                  </Row>
                ))
              : s.allAirports.map((a) => (
                  <Row key={a.key} style={{ alignItems: "center", paddingVertical: 8 }} gap={10}>
                    <Txt mono style={{ fontWeight: "700", width: 52 }}>{a.key}</Txt>
                    <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>{lookupAirport(a.key)?.name ?? ""}</Txt>
                    <Txt variant="small" mono>{t("stats.moves", { n: a.flights })}</Txt>
                  </Row>
                ))}
          </ScrollView>
        </View>
      </Modal>
      {s.fn.length ? (
        <Card>
          <Txt variant="h2">{t("stats.byFunction")}</Txt>
          {s.fn.map((r) => (
            <BarRow key={r.key} label={t(`stats.fn.${r.key}` as never)} value={fmt(r.minutes)} ratio={r.minutes / max(s.fn)} />
          ))}
        </Card>
      ) : null}
      {section(t("stats.byYear"), s.byYear)}
      {section(t("stats.byType"), s.byType)}
      {section(t("stats.airports"), s.topAirports, true)}
      {section(t("stats.registrations"), s.regs)}
      <View style={{ height: space.md }} />
    </Screen>
  );
}

/** Equatorial circumference of the Earth, in nautical miles. */
const EARTH_NM = 21_639;

/** A figure that opens what it counts. */
function Tile({ label, value, sub, onPress }: { label: string; value: string; sub?: string; onPress?: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress ? () => (tap(), onPress()) : undefined}
      disabled={!onPress}
      style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, padding: 12, borderRadius: 14, backgroundColor: pressed ? glass(c).pane : glass(c).input, gap: 2 })}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>{label}</Txt>
        {onPress ? <Ionicons name="chevron-forward" size={14} color={c.muted} /> : null}
      </Row>
      <Txt mono style={{ fontSize: 20, fontWeight: "600" }}>{value}</Txt>
      {sub ? <Txt variant="small" numberOfLines={1}>{sub}</Txt> : null}
    </Pressable>
  );
}
