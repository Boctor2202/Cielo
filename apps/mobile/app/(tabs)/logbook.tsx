import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, SectionList, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { formatClock, formatDuration, operatorIndex, sumFlights, type Flight } from "@cielo/core";
import { useWide, Chip, EmptyState, Fab, Row, Segmented, Txt, tap } from "../../src/components/ui";
import { LogbookCalendar } from "../../src/components/LogbookCalendar";
import Storage from "expo-sqlite/kv-store";
import { formatDate, formatMonth } from "../../src/i18n";
import { useApp } from "../../src/state";
import { airports } from "../../src/airports";
import { airlines } from "../../src/airlines";
import { OperatorField } from "../../src/components/OperatorField";
import { useSyncStatus } from "../../src/syncStatus";
import { font, glass, mono, space, useTheme } from "../../src/theme";

/** Function badges: command green, co-pilot blue, supervised command teal, instruction amber / violet. */
const FN_TONE: Record<string, string> = { PIC: "#34D399", SIC: "#38BDF8", PICUS: "#2DD4BF", DUAL: "#FBBF24", FI: "#A78BFA", FE: "#E879F9" };

interface Section {
  key: string;
  title: string;
  totals: ReturnType<typeof sumFlights>;
  data: Flight[];
}

export default function Logbook() {
  const { access, t, locale, flights, pilot, remove, session, aircraft, put } = useApp();
  const wide = useWide();
  const sync = useSyncStatus();
  // flights changed on this phone and not yet on the server (none to show when not signed in)
  const pendingIds = session ? sync.pendingFlightIds : new Set<string>();
  const c = useTheme();
  const fmt = (m: number) => formatDuration(m, pilot.timeDisplay);

  const [q, setQ] = useState("");
  // list or month calendar, remembered on this phone
  const [view, setView] = useState<"list" | "calendar">(() => {
    try {
      return Storage.getItemSync("logbook.view") === "calendar" ? "calendar" : "list";
    } catch {
      return "list";
    }
  });
  const pickView = (v: "list" | "calendar") => {
    setView(v);
    try {
      Storage.setItemSync("logbook.view", v);
    } catch {
      /* not kept */
    }
  };
  // filters: year, aircraft type, function, conditions (each "" = all)
  const [showFilters, setShowFilters] = useState(false);
  const [fYear, setFYear] = useState("");
  const [fType, setFType] = useState("");
  const [fFn, setFFn] = useState("");
  const [fCond, setFCond] = useState<"" | "night" | "ifr" | "fstd">("");
  const [fOp, setFOp] = useState("");
  const filtersOn = !!(fYear || fType || fFn || fCond || fOp);
  const ops = useMemo(() => operatorIndex(flights, aircraft, airlines()), [flights, aircraft]);
  const years = useMemo(() => [...new Set(flights.map((f) => f.date.slice(0, 4)))].sort().reverse(), [flights]);
  const typesFlown = useMemo(() => [...new Set(flights.filter((f) => !f.isFstd && f.aircraftTypeIcao).map((f) => f.aircraftTypeIcao!))].sort(), [flights]);
  const fns = useMemo(() => [...new Set(flights.map((f) => f.function))].sort(), [flights]);
  /** Words all found in the flight (airports, registration, type, flight number, crew, remarks, date), then the filters. */
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return flights.filter((f) => {
      if (fYear && !f.date.startsWith(fYear)) return false;
      if (fType && f.aircraftTypeIcao !== fType) return false;
      if (fFn && f.function !== fFn) return false;
      if (fCond === "night" && !(f.nightMin > 0)) return false;
      if (fCond === "ifr" && !(f.ifrMin > 0 && !f.isFstd)) return false;
      if (fCond === "fstd" && !f.isFstd) return false;
      if (fOp && (fOp === "-" ? !!ops.of(f) || f.isFstd : ops.of(f) !== fOp)) return false;
      if (!words.length) return true;
      const hay = [f.depIcao, f.arrIcao, f.registration, f.aircraftTypeIcao, f.flightNumber, f.picName, f.remarks, f.function, f.date, ops.of(f)].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [flights, q, fYear, fType, fFn, fCond, fOp, ops]);

  // selection, to give flights their operator in one go
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const okDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  /** Every flight shown between two dates (both included), added to the selection. */
  const pickRange = () => {
    const from = okDate(rangeFrom) ? rangeFrom : "0000-01-01";
    const to = okDate(rangeTo) ? rangeTo : "9999-12-31";
    setPicked((p) => new Set([...p, ...shown.filter((f) => f.date >= from && f.date <= to).map((f) => f.id)]));
  };
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopSelecting = () => (setSelecting(false), setPicked(new Set()), setAssignTo(""), setRangeFrom(""), setRangeTo(""));
  const assign = async () => {
    const op = assignTo.trim() || undefined;
    const n = picked.size;
    for (const f of flights) if (picked.has(f.id) && (f.operator ?? undefined) !== op) await put("flights", { ...f, operator: op });
    Alert.alert(t("log.assign.title"), op ? t("log.assign.done", { n, op }) : t("log.assign.cleared", { n }));
    stopSelecting();
  };
  const sum = useMemo(() => sumFlights(shown), [shown]);
  /** flights the CV cannot place: no operator typed or recognised */
  const unassigned = useMemo(() => flights.filter((f) => !f.deletedAt && !f.isFstd && !ops.of(f)).length, [flights, ops]);
  const airportCount = useMemo(() => new Set(shown.filter((f) => !f.isFstd).flatMap((f) => [f.depIcao, f.arrIcao])).size, [shown]);
  const short = (icao: string) => (airports().get(icao) ? airports().shortName(icao) : "");

  const sections = useMemo<Section[]>(() => {
    const byMonth = new Map<string, Flight[]>();
    for (const f of shown) {
      const k = f.date.slice(0, 7);
      const arr = byMonth.get(k) ?? [];
      arr.push(f);
      byMonth.set(k, arr);
    }
    return [...byMonth.entries()].map(([k, data]) => ({ key: k, title: formatMonth(k, locale), totals: sumFlights(data), data }));
  }, [shown, locale]);

  const confirmDelete = (f: Flight) =>
    Alert.alert(t("log.deleteTitle"), t("log.deleteBody", { route: `${f.depIcao}–${f.arrIcao}`, date: formatDate(f.date, locale) }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => void remove("flights", f.id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <SectionList
        sections={view === "calendar" ? [] : sections}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(f) => f.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[{ paddingBottom: 140, paddingTop: space.sm, flexGrow: 1 }, wide ? { width: "100%", maxWidth: 760, alignSelf: "center" } : null]}
        ListHeaderComponent={
          flights.length ? (
            <View style={{ marginHorizontal: space.md, marginTop: space.sm, gap: space.sm }}>
              <Segmented<"list" | "calendar">
                value={view}
                onChange={pickView}
                options={[
                  { value: "list", label: t("cal.list") },
                  { value: "calendar", label: t("cal.calendar") },
                ]}
              />
              <Row style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: glass(c).strong }}>
                <Ionicons name="search" size={16} color={c.muted} />
                <TextInput
                  style={{ flex: 1, color: c.text, ...font.regular, fontSize: 15 }}
                  placeholder={t("log.search")}
                  placeholderTextColor={c.muted}
                  value={q}
                  onChangeText={setQ}
                  autoCorrect={false}
                  autoCapitalize="characters"
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                />
              </Row>
              {unassigned > 0 && fOp !== "-" && access.canWrite ? (
                <Pressable
                  onPress={() => (tap(), setFOp("-"), setSelecting(true))}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.caution + "66", backgroundColor: c.caution + "1a" }}
                >
                  <Ionicons name="business-outline" size={18} color={c.caution} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt style={{ fontWeight: "700" }}>{t("log.unassigned.title", { n: unassigned })}</Txt>
                    <Txt variant="small">{t("log.unassigned.why")}</Txt>
                  </View>
                  <Txt variant="small" color={c.caution} style={{ fontWeight: "700" }}>{t("log.assign.go")}</Txt>
                </Pressable>
              ) : null}
              {/* what the selection adds up to */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  { icon: "time-outline", k: t("log.sum.total"), v: fmt(sum.totalMin + sum.fstdMin), lead: true },
                  { icon: "airplane-outline", k: t("log.sum.flights"), v: String(shown.length) },
                  { icon: "moon-outline", k: t("log.sum.night"), v: fmt(sum.nightMin) },
                  { icon: "cloud-outline", k: "IFR", v: fmt(sum.ifrMin) },
                  { icon: "trending-down-outline", k: t("log.sum.landings"), v: String(sum.landingsDay + sum.landingsNight) },
                  { icon: "location-outline", k: t("log.sum.airports"), v: String(airportCount) },
                ].map((x) => (
                  <View key={x.k} style={{ minWidth: 104, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: x.lead ? c.accent + "66" : glass(c).edge, backgroundColor: x.lead ? c.accent + "1a" : glass(c).strong }}>
                    <Row gap={4} style={{ alignItems: "center" }}>
                      <Ionicons name={x.icon as keyof typeof Ionicons.glyphMap} size={12} color={x.lead ? c.accent : c.muted} />
                      <Txt variant="small" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6 }}>{x.k}</Txt>
                    </Row>
                    <Txt mono style={{ fontSize: 19, fontWeight: "700", marginTop: 2 }} color={x.lead ? c.accent : undefined}>{x.v}</Txt>
                  </View>
                ))}
              </ScrollView>
              <Row style={{ justifyContent: "space-between", alignItems: "center", marginHorizontal: 4 }}>
                <Pressable onPress={() => (tap(), setShowFilters((x) => !x))} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="options-outline" size={15} color={filtersOn ? c.accent : c.muted} />
                  <Txt variant="small" color={filtersOn ? c.accent : c.muted}>{filtersOn ? t("log.filtersOn") : t("log.filters")}</Txt>
                </Pressable>
                {access.canWrite ? (
                  <Pressable onPress={() => (tap(), selecting ? stopSelecting() : setSelecting(true))} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="checkbox-outline" size={15} color={selecting ? c.accent : c.muted} />
                    <Txt variant="small" color={selecting ? c.accent : c.muted}>{selecting ? t("log.assign.stop") : t("log.assign.start")}</Txt>
                  </Pressable>
                ) : null}
              </Row>
              {showFilters ? (
                <View style={{ gap: 6 }}>
                  {[
                    { label: t("log.f.year"), value: fYear, set: setFYear, opts: years },
                    { label: t("log.f.type"), value: fType, set: setFType, opts: typesFlown },
                    { label: t("log.f.function"), value: fFn, set: setFFn, opts: fns },
                    ...(ops.all.length ? [{ label: t("log.f.operator"), value: fOp, set: setFOp, opts: ops.all }] : []),
                  ].map((g) => (
                    <ScrollView key={g.label} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
                      <Txt variant="small" style={{ width: 62 }}>{g.label}</Txt>
                      <Chip label={t("log.f.all")} selected={!g.value} onPress={() => g.set("")} />
                      {g.opts.map((o) => (
                        <Chip key={o} label={o} selected={g.value === o} onPress={() => g.set(g.value === o ? "" : o)} />
                      ))}
                    </ScrollView>
                  ))}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
                    <Txt variant="small" style={{ width: 62 }}>{t("log.f.cond")}</Txt>
                    <Chip label={t("log.f.all")} selected={!fCond} onPress={() => setFCond("")} />
                    {(["night", "ifr", "fstd"] as const).map((k) => (
                      <Chip key={k} label={t(`log.f.${k}`)} selected={fCond === k} onPress={() => setFCond(fCond === k ? "" : k)} />
                    ))}
                  </ScrollView>
                  {filtersOn ? (
                    <Pressable onPress={() => (setFYear(""), setFType(""), setFFn(""), setFCond(""), setFOp(""))} hitSlop={6} style={{ alignSelf: "flex-start", marginLeft: 4 }}>
                      <Txt variant="small" color={c.accent}>{t("log.f.reset")}</Txt>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {view === "calendar" ? <View style={{ marginHorizontal: -space.md }}><LogbookCalendar flights={shown} /></View> : null}
              {view === "list" && (q.trim() || filtersOn) ? (
                <Txt variant="small" style={{ marginTop: 6, marginLeft: 4 }}>
                  {t("log.found", { n: shown.length, time: fmt(sumFlights(shown).totalMin) })}
                </Txt>
              ) : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={view === "calendar" && flights.length ? undefined : q.trim() || filtersOn ? <EmptyState title={t("log.noMatch")} /> : <EmptyState title={t("log.empty")} hint={t("log.emptyHint")} />}
        renderSectionHeader={({ section }) => (
          <Row style={{ justifyContent: "space-between", marginHorizontal: space.md + 4, marginTop: space.lg, paddingHorizontal: 4, paddingVertical: 6 }}>
            <Txt variant="h2" style={{ fontSize: 20, fontWeight: "700", textTransform: "capitalize" }}>
              {section.title}
            </Txt>
            <Txt mono variant="small">
              {t("log.monthTotal", {
                n: section.totals.flights + section.totals.fstdSessions,
                time: fmt(section.totals.totalMin),
              })}
            </Txt>
          </Row>
        )}
        renderItem={({ item: f, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          const d = new Date(`${f.date}T12:00:00Z`);
          return (
            <Pressable
              onPress={() => {
                tap();
                if (selecting) toggle(f.id);
                else router.push({ pathname: "/flight/[id]", params: { id: f.id } });
              }}
              onLongPress={() => {
                tap("medium");
                confirmDelete(f);
              }}
              delayLongPress={350}
              style={({ pressed }) => ({
                marginHorizontal: space.md,
                marginTop: first ? space.sm : 0,
                paddingHorizontal: space.md,
                paddingVertical: 12,
                borderTopLeftRadius: first ? 16 : 0,
                borderTopRightRadius: first ? 16 : 0,
                borderBottomLeftRadius: last ? 16 : 0,
                borderBottomRightRadius: last ? 16 : 0,
                borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
                borderBottomColor: glass(c).edge,
                backgroundColor: picked.has(f.id) ? c.accent + "22" : pressed ? glass(c).pane : glass(c).strong,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              })}
            >
              <Row gap={12}>
                {selecting ? (
                  <View style={{ alignSelf: "center", width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: picked.has(f.id) ? c.accent : c.muted, backgroundColor: picked.has(f.id) ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {picked.has(f.id) ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                  </View>
                ) : null}
                {/* a coloured edge: night flights indigo, IFR sky, VFR green, simulator violet (as on the website) */}
                <View style={{ width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: f.isFstd ? "#A78BFA" : f.nightMin > 0 ? "#818CF8" : f.ifrMin > 0 ? "#38BDF8" : "#34D399" }} />
                {/* date block: day of month, short weekday */}
                <View style={{ width: 44, alignItems: "center", paddingVertical: 4, borderRadius: 10, backgroundColor: glass(c).input }}>
                  <Txt style={{ fontSize: 20, fontWeight: "700", lineHeight: 23 }}>{d.getUTCDate()}</Txt>
                  <Txt variant="small" style={{ fontSize: 11, textTransform: "uppercase" }}>
                    {d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "short", timeZone: "UTC" }).replace(".", "")}
                  </Txt>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Row gap={6} style={{ alignItems: "center" }}>
                    {f.isFstd ? (
                      <Txt style={{ fontSize: 17, fontWeight: "600" }} color="#A78BFA" numberOfLines={1}>{`${t("log.fstd")} ${f.fstdType ?? ""}`}</Txt>
                    ) : (
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start" }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt mono style={{ fontSize: 17, fontWeight: "700", letterSpacing: 0.4 }}>{f.depIcao}</Txt>
                          <Txt variant="small" numberOfLines={1} style={{ fontSize: 11 }}>{short(f.depIcao)}</Txt>
                        </View>
                        {/* one length on every row, so the lines stand aligned */}
                        <View style={{ width: 44, height: 22, justifyContent: "center", alignItems: "center", marginHorizontal: 6 }}>
                          <View style={{ position: "absolute", left: 0, right: 0, top: 11, borderTopWidth: 1, borderStyle: "dashed", borderColor: c.accent + "aa" }} />
                          <View style={{ position: "absolute", left: 0, top: 9, width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent }} />
                          <View style={{ position: "absolute", right: 0, top: 9, width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent }} />
                          <Ionicons name="airplane" size={13} color={c.accent} style={{ backgroundColor: "transparent" }} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt mono style={{ fontSize: 17, fontWeight: "700", letterSpacing: 0.4 }}>{f.arrIcao}</Txt>
                          <Txt variant="small" numberOfLines={1} style={{ fontSize: 11 }}>{short(f.arrIcao)}</Txt>
                        </View>
                      </View>
                    )}
                  </Row>
                  <Row gap={6} style={{ alignItems: "center", flexWrap: "wrap" }}>
                    <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: (FN_TONE[f.function] ?? "#94A3B8") + "26" }}>
                      <Txt mono style={{ fontSize: 11.5, fontWeight: "700" }} color={FN_TONE[f.function] ?? c.muted}>{f.function}</Txt>
                    </View>
                    {f.registration ? (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: glass(c).edge, backgroundColor: glass(c).input }}>
                        <Txt mono style={{ fontSize: 11.5, fontWeight: "600" }}>{f.registration}</Txt>
                      </View>
                    ) : null}
                    <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {[f.aircraftTypeIcao, !f.isFstd && f.outUtc ? `${formatClock(f.outUtc)}–${formatClock(f.inUtc)}` : "", f.flightNumber, ops.of(f)].filter(Boolean).join(" · ")}
                    </Txt>
                  </Row>
                  {pendingIds.has(f.id) ? (
                    <Row gap={4} style={{ alignItems: "center" }}>
                      <Ionicons name="cloud-upload-outline" size={12} color={c.scheme === "dark" ? "#FBBF24" : "#B45309"} />
                      <Txt variant="small" style={{ fontSize: 11 }} color={c.scheme === "dark" ? "#FBBF24" : "#B45309"}>{t("sync.flightPending")}</Txt>
                    </Row>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: c.scheme === "dark" ? "rgba(34,197,94,0.16)" : "rgba(21,128,61,0.10)" }}>
                    <Txt mono style={{ fontWeight: "700", fontSize: 15 }} color={c.accent}>
                      {fmt(f.isFstd ? f.fstdMin : f.totalMin)}
                    </Txt>
                  </View>
                  <Row gap={6} style={{ alignItems: "center" }}>
                    {f.nightMin > 0 ? (
                      <Txt mono variant="small" style={{ fontSize: 12 }} color="#818CF8">
                        ☾ {fmt(f.nightMin)}
                      </Txt>
                    ) : null}
                    {f.ifrMin > 0 && !f.isFstd ? (
                      <Txt mono variant="small" style={{ fontSize: 11, fontWeight: "700" }} color="#38BDF8">IFR</Txt>
                    ) : null}
                    {f.signatureId ? <Ionicons name="shield-checkmark" size={13} color={c.success} /> : null}
                  </Row>
                </View>
              </Row>
            </Pressable>
          );
        }}
      />
      {selecting ? (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 24, gap: 8, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(6,18,38,0.97)" }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Txt color="#fff" style={{ fontWeight: "700" }}>{t("log.assign.picked", { n: picked.size })}</Txt>
            <Pressable onPress={() => setPicked(new Set(shown.map((f) => f.id)))} hitSlop={8}>
              <Txt variant="small" color={c.accent} style={{ fontWeight: "700" }}>{t("log.assign.all", { n: shown.length })}</Txt>
            </Pressable>
          </Row>
          {/* a date range, added to the selection */}
          <Row gap={6} style={{ alignItems: "center" }}>
            {[
              { v: rangeFrom, set: setRangeFrom, ph: t("log.assign.from") },
              { v: rangeTo, set: setRangeTo, ph: t("log.assign.to") },
            ].map((x) => (
              <TextInput
                key={x.ph}
                style={{ flex: 1, color: "#fff", ...mono, fontSize: 14, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)" }}
                placeholder={x.ph}
                placeholderTextColor="rgba(255,255,255,0.45)"
                keyboardType="number-pad"
                maxLength={10}
                value={x.v}
                // digits only: 20261101 → 2026-11-01
                onChangeText={(s) => {
                  const d = s.replace(/\D/g, "").slice(0, 8);
                  x.set(d.length > 6 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d);
                }}
              />
            ))}
            <Pressable disabled={!okDate(rangeFrom) && !okDate(rangeTo)} onPress={pickRange} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: okDate(rangeFrom) || okDate(rangeTo) ? c.accent + "33" : "rgba(255,255,255,0.06)" }}>
              <Ionicons name="calendar" size={16} color={c.accent} />
            </Pressable>
          </Row>
          <OperatorField value={assignTo} onChange={setAssignTo} known={ops.all} placeholder={t("log.assign.placeholder")} dark />
          {ops.all.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {ops.all.slice(0, 8).map((o) => (
                <Chip key={o} label={o} selected={assignTo === o} onPress={() => setAssignTo(o)} />
              ))}
            </ScrollView>
          ) : null}
          <Row gap={8}>
            <Pressable disabled={!picked.size} onPress={() => void assign()} style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: picked.size ? c.accent : c.accent + "55" }}>
              <Txt color="#fff" style={{ fontWeight: "700" }}>{assignTo.trim() ? t("log.assign.go") : t("log.assign.clear")}</Txt>
            </Pressable>
            <Pressable onPress={stopSelecting} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" }}>
              <Txt color="#fff">{t("log.assign.stop")}</Txt>
            </Pressable>
          </Row>
        </View>
      ) : (
        <Fab label={t("flight.new")} onPress={() => router.push(access.canWrite ? "/flight/new" : "/subscription")} />
      )}
    </View>
  );
}
