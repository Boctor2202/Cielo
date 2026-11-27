import React, { useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDuration, localAirportSuggestion, missingAirport, parseDuration, rowMinutes, sameAircraftMissing, type CheckField, type ImportCheck, type ImportChoices, type ImportedRow, type ImportRowEdit, type PageTotalsCheck } from "@cielo/core";
import { useApp } from "../state";
import { useTheme } from "../theme";
import type { I18nKey } from "../i18n";
import { Button, Card, Field, Row, Segmented, Txt } from "./ui";

type ImportRow = ImportedRow & { excluded?: boolean; keepDuplicate?: boolean };

const TOTALS: CheckField[] = ["total", "pic", "dual", "copilot", "picus", "instructor", "multiPilot", "xc", "vfr", "ifr", "night", "landings", "fstd"];
const ALWAYS: CheckField[] = ["total", "pic", "dual", "copilot", "picus", "xc", "vfr", "ifr", "night", "landings"];
const fmt = (f: CheckField, n: number | undefined) => (n === undefined ? "—" : f === "landings" ? String(n) : formatDuration(n));
const dmy = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : d ?? "");
/** "03/08/21", "3/8/2021", "2021-08-03" -> "2021-08-03" */
const toIso = (v: string) => {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return s;
  const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
};
const dur = (v: string) => (v.trim() === "" ? 0 : parseDuration(v.replace(/h/i, ":")) ?? undefined);

/**
 * The single check before an import, as on the website: totals (live), choices for every flight, then the
 * flights one by one — those worth a look first — each editable in place or left out.
 */
export function ImportReview({
  rows,
  check,
  firstRow,
  choices,
  onChoices,
  edits,
  onEdit,
  onConfirm,
  onCancel,
  busy,
  source,
  fills = 0,
  pageCheck = null,
}: {
  rows: ImportRow[];
  check: ImportCheck | null;
  firstRow: number;
  choices: ImportChoices;
  onChoices: (c: ImportChoices) => void;
  edits: Record<number, ImportRowEdit>;
  onEdit: (rowIndex: number, e: ImportRowEdit) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  source?: string | null;
  /** flights already logged that get their takeoffs and landings from this document */
  fills?: number;
  /** a paper logbook: the flights read against the totals printed at the foot of its pages */
  pageCheck?: PageTotalsCheck | null;
}) {
  const { t } = useApp();
  const c = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  // an airfield just given to a local flight, offered to the other flights without one on the same aircraft
  const [bulk, setBulk] = useState<{ code: string; reg: string; rows: ImportRow[] } | null>(null);
  const noAirport = rows.filter(missingAirport);
  const giveAirfield = (r: ImportRow, code: string) => {
    const v = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(v)) return;
    onEdit(r.rowIndex, { ...(edits[r.rowIndex] ?? {}), dep: v, arr: v });
    const others = sameAircraftMissing(rows, r.rowIndex);
    setBulk(others.length ? { code: v, reg: r.input?.registration ?? "", rows: others } : null);
  };
  const dupOf = check?.duplicateOf ?? {};
  const reasons = (r: ImportRow): string[] => {
    if (r.excluded) return [];
    if (r.errors.length) return r.errors.map((e) => t(`irv.err.${e === "date" || e === "route" || e === "times" ? e : "other"}` as I18nKey));
    const d = dupOf[r.rowIndex];
    if (d) {
      const f = d.flight;
      const when = (f.outUtc ?? f.offUtc)?.slice(11, 16);
      return [t(d.kind === "exact" ? "irv.dup.exact" : "irv.dup.probable", { flight: `${dmy(f.date)} ${f.depIcao}→${f.arrIcao}${when ? ` ${when}` : ""} · ${fmt("total", f.totalMin)}` })];
    }
    return (check?.flags[r.rowIndex] ?? []).map((f) =>
      f === "times" ? t("irv.why.times", { total: fmt("total", r.explicit.total) }) : f === "airport" ? t("irv.why.airport") : t("irv.why.diff", { field: t(`irv.f.${f}` as I18nKey) }),
    );
  };
  const toCheck = rows.filter((r) => reasons(r).length > 0);
  const [chosen, setFilter] = useState<"check" | "all" | null>(null);
  const filter = chosen ?? (toCheck.length ? "check" : "all");
  const shown = filter === "check" && toCheck.length ? toCheck : rows;
  const flights = rows.filter((r) => !r.excluded && !r.errors.length && r.input && !r.input.isFstd).length;
  const sessions = rows.filter((r) => !r.excluded && !r.errors.length && r.input?.isFstd).length;
  const lines = TOTALS.map((f) => check?.lines.find((l) => l.field === f)).filter((l): l is NonNullable<typeof l> => !!l && (ALWAYS.includes(l.field) || l.geardown > 0 || (l.file ?? 0) > 0));

  return (
    <>
      <Card>
        <Txt variant="h2">{t("irv.title")}</Txt>
        <Txt variant="small">{t("irv.counts", { f: flights, s: sessions })}</Txt>
        {source ? <Txt variant="small" color={c.accent}>{source}</Txt> : null}
        <Txt variant="small">{t("irv.intro")}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {lines.map((l) => {
            const off = l.file !== undefined && l.rows.length > 0;
            return (
              <View key={l.field} style={{ width: "31%", borderRadius: 12, padding: 8, backgroundColor: off ? `${c.caution}22` : `${c.text}0D` }}>
                <Txt mono style={{ fontSize: 17, fontWeight: "700" }} color={off ? c.caution : l.file !== undefined ? c.accent : undefined}>{fmt(l.field, l.geardown)}</Txt>
                <Txt variant="small">{t(`irv.f.${l.field}` as I18nKey)}{l.file !== undefined ? ` · ${t("irv.read", { v: fmt(l.field, l.file) })}` : ""}</Txt>
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <Txt variant="small">{t("irv.choicesHelp")}</Txt>
        <Segmented label={t("irv.rules")} value={choices.rules} onChange={(rules) => onChoices({ ...choices, rules })} options={(["doc", "VFR", "IFR"] as const).map((v) => ({ value: v, label: v === "doc" ? t("irv.asRead") : v }))} />
        <Segmented label={t("irv.function")} value={choices.function} onChange={(fn) => onChoices({ ...choices, function: fn })} options={(["doc", "PIC", "SIC", "PICUS", "DUAL"] as const).map((v) => ({ value: v, label: v === "doc" ? t("irv.asRead") : v === "DUAL" ? "Dual" : v }))} />
        <Segmented label={t("irv.xc")} value={choices.xc ?? "doc"} onChange={(xc) => onChoices({ ...choices, xc })} options={(["doc", "other", "none"] as const).map((v) => ({ value: v, label: v === "doc" ? t("irv.asRead") : t(`irv.xc_${v}` as I18nKey) }))} />
      </Card>

      {pageCheck ? (
        <Card style={{ gap: 4, backgroundColor: pageCheck.off.length ? `${c.caution}22` : undefined }}>
          {pageCheck.off.length ? (
            <>
              <Txt variant="small" color={c.caution}>{t("irv.pages.off", { read: formatDuration(pageCheck.readMin), expected: formatDuration(pageCheck.expectedMin) })}</Txt>
              {pageCheck.off.slice(0, 12).map((o, k) => (
                <Txt key={k} variant="small" mono color={c.caution}>
                  {"• "}
                  {o.from ? t("irv.pages.page", { from: dmy(o.from), to: dmy(o.to), read: formatDuration(o.readMin), expected: formatDuration(o.expectedMin) }) : t("irv.pages.pageNoDate", { read: formatDuration(o.readMin), expected: formatDuration(o.expectedMin) })}
                </Txt>
              ))}
            </>
          ) : (
            <Txt variant="small">✓ {t("irv.pages.ok", { expected: formatDuration(pageCheck.expectedMin) })}</Txt>
          )}
        </Card>
      ) : null}

      {noAirport.length ? (
        <Card style={{ backgroundColor: `${c.caution}22` }}>
          <Txt variant="small" color={c.caution}>{t("irv.airfield.missing", { n: noAirport.length })}</Txt>
        </Card>
      ) : null}
      {bulk ? (
        <Card style={{ gap: 8, borderWidth: 1, borderColor: c.accent }}>
          <Txt variant="small">{t("irv.airfield.bulk", { code: bulk.code, n: bulk.rows.length, reg: bulk.reg, from: dmy(bulk.rows[0]?.input?.date), to: dmy(bulk.rows[bulk.rows.length - 1]?.input?.date) })}</Txt>
          <Row style={{ gap: 8 }}>
            <Button
              small
              title={t("irv.airfield.apply")}
              onPress={() => {
                for (const o of bulk.rows) onEdit(o.rowIndex, { ...(edits[o.rowIndex] ?? {}), dep: bulk.code, arr: bulk.code });
                setBulk(null);
              }}
            />
            <Button small kind="ghost" title={t("irv.airfield.no")} onPress={() => setBulk(null)} />
          </Row>
        </Card>
      ) : null}

      <Segmented value={filter} onChange={setFilter} options={[{ value: "check", label: t("irv.filterCheck", { n: toCheck.length }) }, { value: "all", label: t("irv.filterAll", { n: rows.length }) }]} />

      {shown.slice(0, 300).map((r) => {
        const why = reasons(r);
        const i = r.input;
        return (
          <Card key={r.rowIndex} style={{ gap: 6, opacity: r.excluded ? 0.55 : 1, borderWidth: why.length ? 1 : 0, borderColor: c.caution }}>
            <Pressable onPress={() => setOpen(open === r.rowIndex ? null : r.rowIndex)} style={{ gap: 3 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt mono style={{ fontWeight: "700", fontSize: 14 }}>{`${r.rowIndex + firstRow} · ${dmy(i?.date)}`}</Txt>
                <Txt mono style={{ fontWeight: "700", fontSize: 14 }}>{i?.isFstd ? i.fstdType ?? t("irv.sim") : `${i?.depIcao ?? "?"} → ${i?.arrIcao ?? "?"}`}</Txt>
              </Row>
              <Txt variant="small">
                {[
                  !i?.isFstd && (i?.out || i?.in) ? [i?.out, i?.in].filter(Boolean).join("–") : "",
                  fmt("total", i?.isFstd ? i.fstdMin : rowMinutes(r)),
                  !i?.isFstd ? [i?.registration, i?.aircraftTypeIcao].filter(Boolean).join(" · ") : "",
                  `${i?.function === "DUAL" ? "Dual" : i?.function ?? ""}${!i?.isFstd ? ` · ${i?.ifr ? "IFR" : "VFR"}` : ""}`,
                  i?.xcMin ? `XC ${formatDuration(i.xcMin)}` : "",
                  r.excluded ? t("irv.excluded") : "",
                ].filter(Boolean).join("  ")}
              </Txt>
              {why.length ? (
                <Row style={{ alignItems: "flex-start", gap: 6 }}>
                  <Ionicons name="warning-outline" size={14} color={c.caution} />
                  <Txt variant="small" color={c.caution} style={{ flex: 1 }}>{why.join(" · ")}</Txt>
                </Row>
              ) : null}
            </Pressable>
            {missingAirport(r) && r.input?.remarks ? <Txt variant="small" color={c.muted}>{r.input.remarks}</Txt> : null}
            {missingAirport(r) && open !== r.rowIndex ? <AirfieldFill suggestion={localAirportSuggestion(rows, r.rowIndex)} onSet={(code) => giveAirfield(r, code)} /> : null}
            {dupOf[r.rowIndex] && !r.excluded ? <Button kind="secondary" title={t("irv.dup.keep")} onPress={() => onEdit(r.rowIndex, { ...(edits[r.rowIndex] ?? {}), keepDuplicate: true })} /> : null}
            {r.keepDuplicate && !dupOf[r.rowIndex] ? (
              <Row style={{ gap: 8, flexWrap: "wrap" }}>
                <Txt variant="small">{t("irv.dup.kept")}</Txt>
                <Pressable onPress={() => onEdit(r.rowIndex, { ...(edits[r.rowIndex] ?? {}), keepDuplicate: false })}>
                  <Txt variant="small" color={c.accent}>{t("irv.dup.undo")}</Txt>
                </Pressable>
              </Row>
            ) : null}
            {open === r.rowIndex && i ? <RowEditor row={r} edit={edits[r.rowIndex] ?? {}} onEdit={(e) => onEdit(r.rowIndex, e)} onClose={() => setOpen(null)} /> : null}
          </Card>
        );
      })}

      <Button title={check && check.kept === 0 && fills ? t("irv.confirmFills", { n: fills }) : t("irv.confirm", { n: check?.kept ?? 0 })} disabled={busy || !check || (check.kept === 0 && !fills)} onPress={onConfirm} />
      <Button kind="secondary" title={t("irv.cancel")} onPress={onCancel} />
    </>
  );
}

function RowEditor({ row, edit, onEdit, onClose }: { row: ImportRow; edit: ImportRowEdit; onEdit: (e: ImportRowEdit) => void; onClose: () => void }) {
  const { t } = useApp();
  const c = useTheme();
  const i = row.input!;
  const set = (patch: ImportRowEdit) => onEdit({ ...edit, ...patch });
  const half = { flexBasis: "47%", flexGrow: 1 } as const;
  const text = (label: string, value: string | undefined, apply: (v: string) => ImportRowEdit, kb: "default" | "numbers-and-punctuation" = "default") => (
    <Field
      style={half}
      label={label}
      monoValue
      defaultValue={value ?? ""}
      autoCapitalize="characters"
      keyboardType={kb}
      onEndEditing={(e) => {
        const v = e.nativeEvent.text;
        if (v !== (value ?? "")) set(apply(v));
      }}
    />
  );
  const time = (label: string, value: number | undefined, apply: (m: number) => ImportRowEdit) =>
    text(label, value !== undefined ? formatDuration(value) : "", (v) => {
      const m = dur(v);
      return m === undefined ? {} : apply(m);
    }, "numbers-and-punctuation");
  return (
    <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: `${c.text}1A`, paddingTop: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {text(t("irv.fld.date"), dmy(i.date), (v) => ({ date: toIso(v) }), "numbers-and-punctuation")}
        {i.isFstd ? (
          <>
            {text(t("irv.fld.fstdType"), i.fstdType, (v) => ({ fstdType: v.toUpperCase() }))}
            {time(t("irv.fld.fstdMin"), i.fstdMin, (m) => ({ fstdMin: m }))}
          </>
        ) : (
          <>
            {text(t("irv.fld.dep"), i.depIcao, (v) => ({ dep: v }))}
            {text(t("irv.fld.arr"), i.arrIcao, (v) => ({ arr: v }))}
            {text(t("irv.fld.out"), i.out, (v) => ({ out: v.replace(/h/i, ":") }), "numbers-and-punctuation")}
            {text(t("irv.fld.in"), i.in, (v) => ({ in: v.replace(/h/i, ":") }), "numbers-and-punctuation")}
            {time(t("irv.fld.total"), row.explicit.total, (m) => ({ total: m }))}
            {text(t("irv.fld.registration"), i.registration, (v) => ({ registration: v }))}
            {text(t("irv.fld.type"), i.aircraftTypeIcao, (v) => ({ type: v }))}
            {text(t("irv.fld.landings"), String((i.landingsDay ?? 0) + (i.landingsNight ?? 0)), (v) => ({ landings: Math.max(0, Number(v) || 0) }), "numbers-and-punctuation")}
            {time(t("irv.fld.night"), i.nightOverrideMin, (m) => ({ night: m }))}
            {time(t("irv.fld.xc"), i.xcMin, (m) => ({ xc: m }))}
          </>
        )}
      </View>
      {!i.isFstd ? <Segmented label={t("irv.rules")} value={i.ifr ? "IFR" : "VFR"} onChange={(v) => set({ rules: v })} options={[{ value: "VFR", label: "VFR" }, { value: "IFR", label: "IFR" }]} /> : null}
      <Segmented
        label={t("irv.function")}
        value={(["PIC", "SIC", "PICUS", "DUAL"].includes(i.function) ? i.function : "PIC") as "PIC" | "SIC" | "PICUS" | "DUAL"}
        onChange={(v) => set({ function: v })}
        options={(["PIC", "SIC", "PICUS", "DUAL"] as const).map((v) => ({ value: v, label: v === "DUAL" ? "Dual" : v }))}
      />
      <Row style={{ justifyContent: "space-between" }}>
        {row.excluded ? (
          <Button kind="secondary" title={t("irv.include")} onPress={() => set({ excluded: false })} />
        ) : (
          <Button kind="secondary" title={t("irv.exclude")} onPress={() => { set({ excluded: true }); onClose(); }} />
        )}
        <Button title={t("irv.ok")} onPress={onClose} />
      </Row>
    </View>
  );
}

/** The airfield of a flight read without one: typed, or the one the flights around it suggest (never filled in alone). */
function AirfieldFill({ suggestion, onSet }: { suggestion?: string; onSet: (code: string) => void }) {
  const { t } = useApp();
  const [code, setCode] = useState("");
  const ok = /^[A-Z0-9]{3,4}$/.test(code);
  return (
    <Row style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <Field
        style={{ width: 110 }}
        monoValue
        value={code}
        maxLength={4}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={t("irv.airfield.ph")}
        accessibilityLabel={t("irv.airfield.label")}
        onChangeText={(v) => setCode(v.toUpperCase())}
        onSubmitEditing={() => ok && onSet(code)}
      />
      <Button small kind="secondary" title={t("irv.airfield.set")} disabled={!ok} onPress={() => onSet(code)} />
      {suggestion ? <Button small kind="ghost" title={t("irv.airfield.suggest", { code: suggestion })} onPress={() => onSet(suggestion)} /> : null}
    </Row>
  );
}
