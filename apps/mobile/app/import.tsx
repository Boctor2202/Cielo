import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, View } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  analyseTable, IMPORT_FIELDS, legsToRows, mappingToTitles, mappingUsable, parseCsv, rowsToFlights, titlesToMapping,
  type ImportField, type ImportedRow, type LogbookLeg, type StoredMapping,
} from "@cielo/core";
import { API_URL } from "../src/api";
import { lookupAirport, toIcao } from "../src/airports";
import { prepareImportedRows, savePrepared, type PreparedImport } from "../src/importer";
import { checkImport, formatDuration, type ImportCheck } from "@cielo/core";
import { Button, Card, Row, Screen, Txt, tap } from "../src/components/ui";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";
import type { I18nKey } from "../src/i18n";

/** A request stays under the server's 4.5 MB body limit: photos go in batches. */
const BATCH_BYTES = 3_300_000;

type Result = { table?: string[][]; legs?: LogbookLeg[]; role?: string | null; reader?: string; source?: string; mapping?: StoredMapping; mappingIndex?: Record<string, number>; error?: string };

/**
 * The universal import, as on the website: photos of paper logbook pages, a PDF statement, a CSV or a pasted
 * e-mail. Dedicated readers first, then Claude; every flight is shown before it is saved.
 */
export default function ImportScreen() {
  const app = useApp();
  const { t, session, pilot, flights, store } = app;
  const c = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportedRow[] | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const [photos, setPhotos] = useState<{ data: string; type: string }[]>([]);
  // a table read here: kept to teach its layout once imported
  const [table, setTable] = useState<{ header: string[]; mapping: Record<ImportField, number> } | null>(null);
  // « Check your totals »: the flights as they would be saved, compared with the file, before anything is stored
  const [review, setReview] = useState<{ prepared: PreparedImport; check: ImportCheck } | null>(null);
  // the last imports on this phone, each can be undone as a whole
  const [batches, setBatches] = useState<{ id: string; at: string; ids: string[] }[]>([]);
  useEffect(() => {
    void store.getMeta("importBatches").then((v) => {
      try {
        setBatches(JSON.parse(v ?? "[]"));
      } catch {}
    });
  }, [store]);
  const saveBatches = async (list: typeof batches) => {
    setBatches(list);
    await store.setMeta("importBatches", JSON.stringify(list.slice(0, 10)));
  };

  const call = async (body: Record<string, unknown>): Promise<Result> => {
    if (!session?.access_token) return { error: "unauthorized" };
    const r = await fetch(`${API_URL}/api/import-any`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ share, ...body }),
    });
    const d = (await r.json().catch(() => ({}))) as Result;
    return r.ok ? d : { ...d, error: d.error ?? (r.status === 413 ? "too_big" : "error") };
  };
  const fail = (code?: string) => Alert.alert(t("uimp.title"), t(`uimp.err.${["plan", "unauthorized", "rate_limited", "unsupported", "too_big", "busy", "xls", "unreadable"].includes(code ?? "") ? code : "error"}` as never));
  const show = (legs: LogbookLeg[], role?: string | null, src?: string | null) => {
    const fn = role === "CDB" || role === "CDT" ? "PIC" : role ? "SIC" : pilot.defaultFunction;
    setRows(legsToRows(legs, (code) => toIcao(code), { function: fn, pilotFlying: false }));
    setSource(src ?? null);
    setTable(null);
    if (!legs.length) Alert.alert(t("uimp.title"), t("uimp.none"));
  };

  /** Photos of logbook pages: read in batches small enough for the server. */
  const readPhotos = async (list = photos) => {
    if (!list.length) return;
    setBusy("photos");
    try {
      const legs: LogbookLeg[] = [];
      let batch: typeof list = [];
      let size = 0;
      let src: string | undefined;
      const flush = async () => {
        if (!batch.length) return;
        const d = await call({ kind: "images", images: batch });
        if (d.error) throw new Error(d.error);
        legs.push(...(d.legs ?? []));
        src = d.source ?? src;
        batch = [];
        size = 0;
      };
      for (const p of list) {
        if (size + p.data.length > BATCH_BYTES) await flush();
        batch.push(p);
        size += p.data.length;
      }
      await flush();
      setPhotos([]);
      show(legs, null, src ?? "ai");
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pickPhotos = async (camera: boolean) => {
    tap();
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.45, base64: true, allowsMultipleSelection: !camera, selectionLimit: 12 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return;
    const next = [...photos, ...r.assets.filter((a) => a.base64).map((a) => ({ data: a.base64!, type: "image/jpeg" }))].slice(0, 12);
    setPhotos(next);
  };

  const pickFile = async () => {
    tap();
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/csv", "text/comma-separated-values", "text/plain", "*/*"], copyToCacheDirectory: true });
    const a = res.canceled ? undefined : res.assets?.[0];
    if (!a) return;
    setBusy("file");
    try {
      if (/\.pdf$/i.test(a.name) || a.mimeType === "application/pdf") {
        const pdf = await new File(a.uri).base64();
        if (pdf.length > BATCH_BYTES * 1.3) return fail("too_big");
        const d = await call({ kind: "pdf", pdf, fileName: a.name });
        if (d.error || !d.legs) return fail(d.error);
        return show(d.legs, d.role, d.reader === "airfrance-ep5" ? "Air France · EP5" : d.source ?? "ai");
      }
      // Excel 97-2003 (.xls) cannot be read: ask for .xlsx or CSV
      if (/\.xls$/i.test(a.name) || a.mimeType === "application/vnd.ms-excel") return fail("xls");
      // a workbook (.xlsx) is unzipped on the server into a table; a CSV / text file is read here
      let cells: string[][];
      if (/\.xlsx$/i.test(a.name) || a.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        const data = await new File(a.uri).base64();
        if (data.length > BATCH_BYTES * 1.3) return fail("too_big");
        const d = await call({ kind: "sheet", data, fileName: a.name });
        if (d.error || !d.table) return fail(d.error);
        cells = d.table;
      } else cells = parseCsv((await new File(a.uri).text()).replace(/^\uFEFF/, ""));
      // columns found by themselves, else learned or mapped on the server
      const an = analyseTable(cells);
      let mapping = an.mapping;
      let src: string | null = an.app ?? null;
      if (!an.app && !mappingUsable(an.mapping)) {
        const d = await call({ kind: "table", header: an.header, rows: an.rows.slice(0, 25), fileName: a.name });
        if (d.mapping) {
          mapping = titlesToMapping(an.header, d.mapping, IMPORT_FIELDS);
          src = "learned";
        } else if (d.mappingIndex) {
          mapping = { ...an.mapping, ...(d.mappingIndex as Record<ImportField, number>) };
          src = d.source ?? "ai";
        } else if (d.error && d.error !== "plan") return fail(d.error);
      }
      setRows(rowsToFlights(an.rows, mapping, { dateOrder: an.dateOrder, defaultFunction: pilot.defaultFunction, timezoneOf: (c) => lookupAirport(toIcao(c))?.timezone }));
      setTable({ header: an.header, mapping });
      setSource(src);
    } catch {
      fail();
    } finally {
      setBusy(null);
    }
  };

  const pasteText = async () => {
    tap();
    const text = await Clipboard.getStringAsync().catch(() => "");
    if (!text.trim()) return Alert.alert(t("uimp.title"), t("uimp.clipboardEmpty"));
    setBusy("text");
    try {
      const d = await call({ kind: "text", text });
      if (d.error || !d.legs) return fail(d.error);
      show(d.legs, null, d.reader === "report" ? "report" : d.source ?? "ai");
    } finally {
      setBusy(null);
    }
  };

  const ok = useMemo(() => (rows ?? []).filter((r) => r.input && !r.errors.length), [rows]);
  const prepare = async () => {
    setBusy("save");
    try {
      const prepared = await prepareImportedRows(store, pilot, app.aircraftTypes, flights, ok, "import");
      setReview({ prepared, check: checkImport(rows ?? [], prepared.pairs, prepared.duplicates) });
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (!review) return;
    setBusy("save");
    try {
      const r = await savePrepared(store, review.prepared);
      if (r.ids.length) await saveBatches([{ id: `${Date.now()}`, at: new Date().toISOString(), ids: r.ids }, ...batches]);
      // a table imported with its columns: the layout is kept for the next pilot (column titles only)
      if (table && r.imported) void call({ kind: "learn", header: table.header, mapping: mappingToTitles(table.header, table.mapping), source: source ?? undefined }).catch(() => undefined);
      await app.reload();
      Alert.alert(t("uimp.title"), t("more.importDone", { n: r.imported, d: r.duplicates, s: rows!.length - ok.length + r.skipped }));
      setReview(null);
      setRows(null);
      router.back();
    } finally {
      setBusy(null);
    }
  };
  const undo = (b: (typeof batches)[number]) =>
    Alert.alert(t("uimp.undo"), t("uimp.undoConfirm", { n: b.ids.length }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("uimp.undo"),
        style: "destructive",
        onPress: async () => {
          for (const id of b.ids) await app.remove("flights", id);
          await saveBatches(batches.filter((x) => x.id !== b.id));
          await app.reload();
        },
      },
    ]);

  const Big = ({ icon, label, hint, onPress, k }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; onPress: () => void; k: string }) => (
    <Pressable onPress={onPress} disabled={!!busy} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,22,38,0.12)", opacity: busy && busy !== k ? 0.5 : 1, backgroundColor: pressed ? c.accent + "14" : "transparent" })}>
      <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.accent + "22" }}>
        {busy === k ? <ActivityIndicator color={c.accent} /> : <Ionicons name={icon} size={21} color={c.accent} />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontWeight: "800" }}>{label}</Txt>
        <Txt variant="small">{hint}</Txt>
      </View>
    </Pressable>
  );

  if (rows && review) {
    const ck = review.check;
    const shown = ck.lines.filter((l) => l.file !== undefined || l.geardown > 0);
    const v = (f: string, n: number | undefined) => (n === undefined ? "—" : f === "landings" ? String(n) : formatDuration(n));
    return (
      <Screen>
        <Card>
          <Txt variant="h2">{t("uimp.checkTitle")}</Txt>
          <Txt variant="small">{t("uimp.checkIntro", { n: ck.kept })}</Txt>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt variant="small" style={{ flex: 1.3, fontWeight: "700" }}>{t("uimp.colField")}</Txt>
            <Txt variant="small" style={{ flex: 1, textAlign: "right", fontWeight: "700" }}>{t("uimp.colFile")}</Txt>
            <Txt variant="small" style={{ flex: 1, textAlign: "right", fontWeight: "700" }}>Geardown</Txt>
          </Row>
          {shown.map((l) => (
            <View key={l.field} style={{ gap: 1 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt style={{ flex: 1.3 }}>{t(`uimp.f.${l.field}` as I18nKey)}</Txt>
                <Txt mono style={{ flex: 1, textAlign: "right" }}>{v(l.field, l.file)}</Txt>
                <Txt mono style={{ flex: 1, textAlign: "right", fontWeight: "700" }} color={l.rows.length ? c.caution : undefined}>{v(l.field, l.geardown)}</Txt>
              </Row>
              {l.rows.length ? <Txt variant="small" color={c.caution}>{t("uimp.diffRows", { rows: l.rows.slice(0, 20).join(", ") })}</Txt> : null}
            </View>
          ))}
          {ck.lines.some((l) => l.rows.length) ? <Txt variant="small">{t("uimp.diffHelp")}</Txt> : null}
        </Card>
        {ck.rejected.length ? (
          <Card>
            <Txt style={{ fontWeight: "700" }}>{t("uimp.rejected", { n: ck.rejected.length })}</Txt>
            {ck.rejected.slice(0, 60).map((r) => (
              <Txt key={r.row} variant="small">{t("uimp.rejectedLine", { row: r.row, reasons: r.reasons.map((x) => t(`uimp.reason.${x}` as I18nKey)).join(", ") })}</Txt>
            ))}
          </Card>
        ) : null}
        <Row gap={10}>
          <Button style={{ flex: 1 }} kind="secondary" title={t("uimp.fix")} onPress={() => setReview(null)} />
          <Button style={{ flex: 1 }} title={t("uimp.confirm", { n: ck.kept })} disabled={!ck.kept || busy === "save"} onPress={() => void save()} />
        </Row>
        <Button kind="secondary" title={t("uimp.cancelImport")} onPress={() => { setReview(null); setRows(null); }} />
      </Screen>
    );
  }

  if (rows) {
    return (
      <Screen>
        <Card>
          <Txt variant="h2">{t("uimp.found", { n: ok.length })}</Txt>
          {source ? <Txt variant="small" color={c.accent}>{source === "learned" ? t("uimp.learned") : source === "report" ? t("uimp.report") : t("uimp.ai", { source })}</Txt> : null}
          {rows.length - ok.length ? <Txt variant="small" color={c.warning}>{t("uimp.skipped", { n: rows.length - ok.length })}</Txt> : null}
        </Card>
        {ok.slice(0, 200).map((r) => (
          <Row key={r.rowIndex} style={{ justifyContent: "space-between", paddingHorizontal: 6 }}>
            <Txt mono style={{ fontSize: 13 }}>{`${r.input!.date}  ${r.input!.depIcao} → ${r.input!.arrIcao}`}</Txt>
            <Txt mono variant="small">{[r.input!.out, r.input!.in].filter(Boolean).join("–") || (r.explicit.total ? `${Math.floor(r.explicit.total / 60)}:${String(r.explicit.total % 60).padStart(2, "0")}` : "")}</Txt>
          </Row>
        ))}
        <Row gap={10}>
          <Button style={{ flex: 1 }} kind="secondary" title={t("common.cancel")} onPress={() => setRows(null)} />
          <Button style={{ flex: 1 }} title={t("uimp.checkN", { n: ok.length })} disabled={!ok.length || busy === "save"} onPress={() => void prepare()} />
        </Row>
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt variant="muted">{t("uimp.intro")}</Txt>
      {batches.length ? (
        <Card>
          <Txt style={{ fontWeight: "700" }}>{t("uimp.batches")}</Txt>
          {batches.map((b) => (
            <Row key={b.id} style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="small" style={{ flex: 1 }}>{t("uimp.batchLine", { n: b.ids.length, date: b.at.slice(0, 10) })}</Txt>
              <Pressable onPress={() => undo(b)} hitSlop={8}>
                <Txt variant="small" color={c.accent} style={{ fontWeight: "700" }}>{t("uimp.undo")}</Txt>
              </Pressable>
            </Row>
          ))}
        </Card>
      ) : null}
      <Big k="photos" icon="camera" label={t("uimp.camera")} hint={t("uimp.cameraHint")} onPress={() => void pickPhotos(true)} />
      <Big k="photos" icon="images" label={t("uimp.library")} hint={t("uimp.libraryHint")} onPress={() => void pickPhotos(false)} />
      {photos.length ? (
        <Card>
          <Txt>{t("uimp.photosReady", { n: photos.length })}</Txt>
          <Row gap={10}>
            <Button style={{ flex: 1 }} kind="secondary" title={t("uimp.clear")} onPress={() => setPhotos([])} />
            <Button style={{ flex: 1 }} title={t("uimp.read")} disabled={busy === "photos"} onPress={() => void readPhotos()} />
          </Row>
        </Card>
      ) : null}
      <Big k="file" icon="document-text" label={t("uimp.file")} hint={t("uimp.fileHint")} onPress={() => void pickFile()} />
      <Big k="text" icon="clipboard" label={t("uimp.paste")} hint={t("uimp.pasteHint")} onPress={() => void pasteText()} />
      <Row gap={10} style={{ alignItems: "center" }}>
        <Switch value={share} onValueChange={setShare} />
        <Txt variant="small" style={{ flex: 1 }}>{t("uimp.share")}</Txt>
      </Row>
    </Screen>
  );
}
