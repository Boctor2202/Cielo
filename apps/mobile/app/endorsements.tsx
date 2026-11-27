import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, Share, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  AC_61_65K,
  blanksLeft,
  canonicalEndorsement,
  endorsementSignatureLine,
  endorsementTemplate,
  endorsementValidUntil,
  fillEndorsement,
  type Endorsement,
} from "@cielo/core";
import { API_URL } from "../src/api";
import { usePrompt } from "../src/components/TextPrompt";
import { Button, Card, Chip, Field, Row, Screen, Segmented, Txt, tap } from "../src/components/ui";
import { DateField, isValidDate } from "../src/components/DateField";
import { SignatureImage, SignaturePad, signatureSvg } from "../src/components/SignaturePad";
import { formatDate } from "../src/i18n";
import { todayUtc, useApp } from "../src/state";
import { space, useTheme } from "../src/theme";

type Draft = Partial<Endorsement> & Pick<Endorsement, "direction" | "templateId" | "title" | "text" | "studentName" | "issuedOn" | "source">;
const hash = (e: Parameters<typeof canonicalEndorsement>[0]) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalEndorsement(e));

/**
 * FAA logbook endorsements (AC 61-65K): received (signed on this phone by the instructor, by link, or copied
 * from paper) and given, the instructor's record (14 CFR 61.189).
 */
export default function EndorsementsScreen() {
  const { t, store, put, pilot, locale, session } = useApp();
  const prompt = usePrompt();
  const c = useTheme();
  const [all, setAll] = useState<Endorsement[]>([]);
  const [tab, setTab] = useState<"received" | "given">("received");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [signing, setSigning] = useState<Endorsement | null>(null);
  const reload = useCallback(() => void store.all("endorsements").then(setAll), [store]);
  useEffect(reload, [reload]);
  const save = async (row: Partial<Endorsement>) => {
    await put("endorsements", { ...row, pilotId: pilot.id });
    reload();
  };
  const list = useMemo(() => all.filter((e) => !e.deletedAt && e.direction === tab).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn)), [all, tab]);
  const today = todayUtc();

  return (
    <View style={{ flex: 1 }}>
      {prompt.node}
      <Screen>
        <Txt variant="small">{t("end.subtitle")}</Txt>
        <Segmented value={tab} onChange={setTab} options={[{ value: "received", label: t("end.received") }, { value: "given", label: t("end.given") }]} />
        <Row gap={8}>
          <Button title={t("end.add")} onPress={() => setDraft({ direction: tab, templateId: "", title: "", text: "", studentName: tab === "received" ? (pilot.fullName ?? "") : "", issuedOn: today, source: "here" })} style={{ flex: 1 }} />
          <Button kind="secondary" title="8710" onPress={() => router.push("/report8710")} />
        </Row>
        {tab === "given" ? <Txt variant="small">{t("end.givenHint")}</Txt> : null}
        {list.length === 0 ? <Txt variant="muted">{tab === "received" ? t("end.emptyReceived") : t("end.emptyGiven")}</Txt> : null}
        {list.map((e) => (
          <EndorsementItem key={e.id} e={e} today={today} onSign={() => setSigning(e)} onDelete={() => Alert.alert(t("end.deleteConfirm"), "", [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => void save({ ...e, deletedAt: new Date().toISOString() }) }])} onLink={() => void sendLink(e)} />
        ))}
        <Txt variant="small" color={c.muted}>{t("end.source")}</Txt>
      </Screen>
      {draft ? <EditSheet draft={draft} onClose={() => setDraft(null)} onSave={async (d) => (await save({ ...d, expiresOn: endorsementValidUntil(d.templateId, d.issuedOn) }), setDraft(null))} /> : null}
      {signing ? (
        <SignSheet
          e={signing}
          onClose={() => setSigning(null)}
          onSigned={async (s) => {
            const sealed = { ...signing, ...s };
            await save({ ...sealed, signedAt: new Date().toISOString(), source: "here", contentHash: await hash(sealed), expiresOn: endorsementValidUntil(signing.templateId, signing.issuedOn) });
            setSigning(null);
          }}
        />
      ) : null}
    </View>
  );

  /** A link for an instructor without Geardown: they read and sign in their browser; shared from the phone. */
  async function sendLink(e: Endorsement): Promise<void> {
    if (blanksLeft(e.text).length) return Alert.alert(t("end.linkTitle"), t("end.blanksFirst", { list: blanksLeft(e.text).join(" ") }));
    if (!session?.access_token) return Alert.alert(t("end.linkTitle"), t("end.linkErr.unauthorized"));
    const name = await prompt.ask({ title: t("end.linkTitle"), message: t("end.linkHint"), defaultValue: e.instructorName ?? "", okLabel: t("end.createLink"), cancelLabel: t("common.cancel"), autoCapitalize: "words" });
    if (!name?.trim()) return;
      void (async () => {
        const call = () =>
          fetch(`${API_URL}/api/sign-link`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, "x-client": Platform.OS },
            body: JSON.stringify({ action: "create", endorsementId: e.id, signerName: name.trim(), locale }),
          });
        // the endorsement must reach the account first: the sync runs after each save, wait for it a little
        let r = await call();
        for (let i = 0; i < 3 && r.status === 409; i++) {
          await new Promise((res) => setTimeout(res, 2500));
          r = await call();
        }
        const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!r.ok || !d.url) {
          const code = d.error ?? "error";
          return Alert.alert(t("end.linkTitle"), t(`end.linkErr.${["plan", "blanks", "not_synced"].includes(code) ? code : "error"}` as never));
        }
        await Share.share({ message: t("end.linkMessage", { url: d.url }) });
      })();
  }
}

function EndorsementItem({ e, today, onSign, onDelete, onLink }: { e: Endorsement; today: string; onSign: () => void; onDelete: () => void; onLink: () => void }) {
  const { t, locale } = useApp();
  const c = useTheme();
  const [valid, setValid] = useState<boolean | null>(null);
  useEffect(() => {
    if (!e.signedAt || !e.contentHash) return setValid(null);
    void hash(e).then((h) => setValid(h === e.contentHash));
  }, [e]);
  const left = e.expiresOn ? Math.round((Date.parse(e.expiresOn) - Date.parse(today)) / 86_400_000) : null;
  const tone = left === null ? c.muted : left < 0 ? c.warning : left <= 14 ? c.caution : c.success;
  return (
    <Card style={{ gap: 6 }}>
      <Txt variant="label">{[e.templateId !== "custom" ? e.templateId : null, e.regulation].filter(Boolean).join(" · ")}</Txt>
      <Txt style={{ fontWeight: "700" }}>{e.title}</Txt>
      <Txt variant="small">{[e.direction === "given" ? e.studentName : null, formatDate(e.issuedOn, locale), e.aircraft].filter(Boolean).join(" · ")}</Txt>
      <Row gap={8} style={{ flexWrap: "wrap" }}>
        {e.expiresOn ? <Txt variant="small" color={tone} style={{ fontWeight: "700" }}>{left! < 0 ? t("end.expired", { date: formatDate(e.expiresOn, locale) }) : t("end.validUntil", { date: formatDate(e.expiresOn, locale) })}</Txt> : null}
        {e.direction === "received" ? (
          <Txt variant="small" color={!e.signedAt ? c.caution : valid === false ? c.warning : c.success} style={{ fontWeight: "700" }}>
            {!e.signedAt ? t("end.unsigned") : valid === false ? t("end.changed") : e.source === "paper" ? t("end.paper") : t("end.signed")}
          </Txt>
        ) : null}
      </Row>
      <Txt style={{ lineHeight: 21 }}>{e.text}</Txt>
      {e.testKind ? <Txt variant="small">{[e.testKind, e.testResult].filter(Boolean).join(" · ")}</Txt> : null}
      {e.signedAt ? (
        <View style={{ gap: 4 }}>
          {e.signatureImage ? (
            <View style={{ backgroundColor: "#fff", borderRadius: 8, padding: 4, alignSelf: "flex-start" }}>
              <SignatureImage dataUrl={e.signatureImage} />
            </View>
          ) : null}
          <Txt variant="small" mono>{endorsementSignatureLine(e)}</Txt>
        </View>
      ) : null}
      <Row gap={8} style={{ flexWrap: "wrap" }}>
        {e.direction === "received" && !e.signedAt ? (
          <>
            <Button small title={t("end.signHere")} onPress={onSign} />
            <Button small kind="secondary" title={t("end.sendLink")} onPress={onLink} />
          </>
        ) : null}
        <Button small kind="ghost" title={t("common.delete")} onPress={onDelete} />
      </Row>
    </Card>
  );
}

/** Pick a sample (or write one), fill it in, save it unsigned. */
function EditSheet({ draft: initial, onClose, onSave }: { draft: Draft; onClose: () => void; onSave: (d: Draft) => Promise<void> }) {
  const { t } = useApp();
  const c = useTheme();
  const [d, setD] = useState<Draft>(initial);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(!initial.templateId);
  const [touched, setTouched] = useState(false);
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return AC_61_65K.filter((x) => !s || `${x.id} ${x.title} ${x.ref}`.toLowerCase().includes(s));
  }, [q]);
  const fill = (next: Draft) => {
    const tpl = endorsementTemplate(next.templateId);
    setD(tpl && !touched ? { ...next, text: fillEndorsement(tpl.text, next) } : next);
  };
  const pick = (id: string) => {
    tap();
    const tpl = endorsementTemplate(id);
    setPicking(false);
    setTouched(false);
    setD(tpl ? { ...d, templateId: tpl.id, title: tpl.title, regulation: tpl.ref, text: fillEndorsement(tpl.text, d) } : { ...d, templateId: "custom", title: "", regulation: "", text: "" });
  };
  const blanks = blanksLeft(d.text);
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Row style={{ justifyContent: "space-between", padding: space.lg, paddingBottom: 8 }}>
          <Txt variant="h2">{d.direction === "received" ? t("end.newReceived") : t("end.newGiven")}</Txt>
          <Ionicons name="close" size={22} color={c.muted} onPress={onClose} />
        </Row>
        {picking ? (
          <>
            <View style={{ paddingHorizontal: space.lg }}>
              <TextInput value={q} onChangeText={setQ} placeholder={t("end.search")} placeholderTextColor={c.muted} autoFocus style={{ color: c.text, backgroundColor: c.surface, borderRadius: 12, padding: 12, fontSize: 15 }} />
            </View>
            <FlatList
              data={[...found, { id: "custom" } as (typeof found)[number]]}
              keyExtractor={(x) => x.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: space.lg, gap: 4 }}
              renderItem={({ item: x }) => (
                <Pressable onPress={() => pick(x.id)} style={{ flexDirection: "row", gap: 10, paddingVertical: 9 }}>
                  {x.id === "custom" ? (
                    <Txt color={c.muted}>{t("end.custom")}</Txt>
                  ) : (
                    <>
                      <Txt mono style={{ width: 42, fontWeight: "700" }} color={c.accent}>{x.id}</Txt>
                      <View style={{ flex: 1 }}>
                        <Txt>{x.title}</Txt>
                        <Txt variant="small">{x.ref}</Txt>
                      </View>
                    </>
                  )}
                </Pressable>
              )}
            />
          </>
        ) : (
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Txt style={{ fontWeight: "700" }}>{d.templateId !== "custom" ? `${d.templateId} · ` : ""}{d.title || t("end.custom")}</Txt>
            {d.regulation ? <Txt variant="small">{d.regulation}</Txt> : null}
            {d.templateId === "custom" ? (
              <>
                <Field label={t("end.f.title")} value={d.title} onChangeText={(v) => setD({ ...d, title: v })} />
                <Field label={t("end.f.regulation")} value={d.regulation ?? ""} onChangeText={(v) => setD({ ...d, regulation: v })} />
              </>
            ) : null}
            <Field label={d.direction === "received" ? t("end.f.pilot") : t("end.f.student")} value={d.studentName} onChangeText={(v) => fill({ ...d, studentName: v })} />
            <Field label={t("end.f.aircraft")} value={d.aircraft ?? ""} placeholder="Cessna 172S" onChangeText={(v) => fill({ ...d, aircraft: v })} />
            <DateField label={t("end.f.date")} value={d.issuedOn} onChange={(v) => setD({ ...d, issuedOn: v })} />
            <Field label={t("end.f.text")} value={d.text} multiline style={{ minHeight: 140 }} onChangeText={(v) => (setTouched(true), setD({ ...d, text: v }))} />
            {blanks.length ? <Txt variant="small" color={c.caution}>{t("end.blanks", { list: blanks.join(" ") })}</Txt> : null}
            {d.direction === "given" ? (
              <>
                <Field label={t("end.f.testKind")} value={d.testKind ?? ""} placeholder={t("end.f.testKindPh")} onChangeText={(v) => setD({ ...d, testKind: v })} />
                <Field label={t("end.f.testResult")} value={d.testResult ?? ""} onChangeText={(v) => setD({ ...d, testResult: v })} />
              </>
            ) : null}
            <Button title={t("common.save")} disabled={!d.title.trim() || !d.text.trim() || !d.studentName.trim() || !isValidDate(d.issuedOn)} onPress={() => void onSave(d)} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

/** The instructor signs on this phone: certificate, its date, the drawn signature. */
function SignSheet({ e, onClose, onSigned }: { e: Endorsement; onClose: () => void; onSigned: (s: Pick<Endorsement, "instructorName" | "instructorCertificate" | "instructorCertKind" | "instructorCertDate" | "signatureImage">) => Promise<void> }) {
  const { t } = useApp();
  const c = useTheme();
  const [name, setName] = useState(e.instructorName ?? "");
  const [cert, setCert] = useState("");
  const [kind, setKind] = useState<"RE" | "Exp" | "ground">("RE");
  const [date, setDate] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const blanks = blanksLeft(e.text);
  const ready = !blanks.length && name.trim() && cert.trim() && paths.length > 0 && (kind === "ground" || isValidDate(date));
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" scrollEnabled={paths.length === 0}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt variant="h2">{t("end.signTitle")}</Txt>
          <Ionicons name="close" size={22} color={c.muted} onPress={onClose} />
        </Row>
        <Card style={{ gap: 6 }}>
          <Txt variant="label">{e.templateId} · {e.regulation}</Txt>
          <Txt style={{ fontWeight: "700" }}>{e.title}</Txt>
          <Txt>{e.text}</Txt>
        </Card>
        {blanks.length ? (
          <Txt color={c.warning}>{t("end.blanksFirst", { list: blanks.join(" ") })}</Txt>
        ) : (
          <>
            <Txt variant="small">{t("end.signIntro")}</Txt>
            <Field label={t("end.f.instructor")} value={name} onChangeText={setName} autoCapitalize="words" />
            <Field label={t("end.f.certificate")} value={cert} onChangeText={setCert} monoValue autoCapitalize="characters" placeholder="987654321CFI" />
            <Row gap={6} style={{ flexWrap: "wrap" }}>
              {(["RE", "Exp", "ground"] as const).map((k) => (
                <Chip key={k} label={t(`end.kind.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </Row>
            {kind !== "ground" ? <DateField label={kind === "RE" ? t("end.f.dateRE") : t("end.f.dateExp")} value={date} onChange={setDate} /> : null}
            <Txt variant="label">{t("end.draw")}</Txt>
            <SignaturePad onChange={setPaths} />
            <Txt variant="small">{t("end.attest")}</Txt>
          </>
        )}
        <Button
          title={t("end.sign")}
          disabled={!ready}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onSigned({ instructorName: name.trim(), instructorCertificate: cert.trim(), instructorCertKind: kind === "ground" ? null : kind, instructorCertDate: kind === "ground" ? null : date, signatureImage: signatureSvg(paths) });
            } finally {
              setBusy(false);
            }
          }}
        />
      </ScrollView>
    </Modal>
  );
}

