import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDuration } from "@cielo/core";
import { Badge, Button, Card, EmptyState, Field, Row, Screen, ToggleRow, Txt, tap } from "../../src/components/ui";
import { Requires } from "../../src/components/Access";
import { SignaturePad, signatureSvg } from "../../src/components/SignaturePad";
import { createSignLink, crewAction, loadCrew, type Captain, type CrewData, type ToSign } from "../../src/crew";
import { formatDate } from "../../src/i18n";
import { useApp } from "../../src/state";
import { space, useTheme } from "../../src/theme";

export default function CrewScreen() {
  return (
    <Requires feature="signature">
      <Crew />
    </Requires>
  );
}

/**
 * Signatures between Geardown pilots: the captains named on the pilot's flights and their link to a Geardown
 * account, the link requests received, and the flights other pilots ask this pilot to sign.
 */
function Crew() {
  const { t, locale, session, reload } = useApp();
  const c = useTheme();
  const token = session?.access_token;
  const [data, setData] = useState<CrewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await loadCrew(token));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [token]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const act: Act = async (key, body, done) => {
    setBusy(key);
    try {
      const r = await crewAction<{ status?: string }>(token, body);
      tap("success");
      done?.(r);
      await refresh();
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error && e.message === "plan" ? t("crew.err.plan") : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!token) return <Screen><EmptyState title={t("crew.signin")} /></Screen>;
  if (!data) {
    return (
      <Screen>
        {error ? <Txt color={c.warning}>{error}</Txt> : <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />}
      </Screen>
    );
  }

  const pendingLinks = data.linkRequests.filter((l) => l.status === "pending");
  const acceptedLinks = data.linkRequests.filter((l) => l.status === "accepted");
  // the captains with something to do or to show first
  const rank = (x: Captain) => (x.link?.status === "accepted" ? 0 : x.link?.status === "pending" ? 1 : x.match ? 2 : 3);
  const captains = [...data.captains].sort((a, b) => rank(a) - rank(b) || b.flights - a.flights);

  return (
    <Screen>
      <Txt variant="small">{t("crew.intro")}</Txt>

      {data.autoSigned?.length ? (
        <Card>
          <Row style={{ alignItems: "center" }}>
            <Ionicons name="flash-outline" size={18} color={c.accent} />
            <Txt style={{ fontWeight: "700", flex: 1 }}>{t("crew.autoSignedTitle")}</Txt>
          </Row>
          {data.autoSigned.map((a) => (
            <Txt key={a.from} variant="small">{t("crew.autoSignedRow", { name: a.from, n: a.flights })}</Txt>
          ))}
        </Card>
      ) : null}
      {data.toSign.length ? <ToSignCard items={data.toSign} me={data.me} token={token} onDone={refresh} /> : null}

      {pendingLinks.map((l) => (
        <Card key={l.id}>
          <Row style={{ alignItems: "center" }}>
            <Ionicons name="link" size={18} color={c.accent} />
            <Txt style={{ fontWeight: "700", flex: 1 }}>{t("crew.linkReq.title", { name: l.from })}</Txt>
          </Row>
          <Txt variant="small">{t("crew.linkReq.body", { name: l.from, crew: l.crewName, n: l.flights })}</Txt>
          <Txt variant="small" color={l.shared ? c.success : c.caution}>
            {l.shared ? t("crew.linkReq.shared", { n: l.shared }) : t("crew.linkReq.noShared")}
          </Txt>
          <Txt variant="small">{t(`crew.via.${l.via}` as const)}</Txt>
          <Row gap={space.xs}>
            <Button style={{ flex: 1 }} title={t("crew.accept")} loading={busy === `a${l.id}`} onPress={() => void act(`a${l.id}`, { action: "respondLink", id: l.id, accept: true })} />
            <Button style={{ flex: 1 }} kind="secondary" title={t("crew.notMe")} loading={busy === `r${l.id}`} onPress={() => void act(`r${l.id}`, { action: "respondLink", id: l.id, accept: false })} />
          </Row>
        </Card>
      ))}

      <Txt variant="h2">{t("crew.myCaptains")}</Txt>
      {captains.length === 0 ? <EmptyState title={t("crew.noCaptains")} /> : null}
      {captains.map((x) => (
        <CaptainCard key={x.name} x={x} busy={busy} act={act} />
      ))}

      {acceptedLinks.length ? (
        <Card>
          <Txt variant="label">{t("crew.iSignFor")}</Txt>
          {acceptedLinks.map((l) => (
            <View key={l.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Txt style={{ flex: 1 }}>{`${l.from} · « ${l.crewName} »`}</Txt>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert(t("crew.unlink"), t("crew.unlinkConfirm", { name: l.from }), [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("crew.unlink"), style: "destructive", onPress: () => void act(`u${l.id}`, { action: "unlink", id: l.id }) },
                  ])
                }
              >
                <Txt variant="small" color={c.warning}>{t("crew.unlink")}</Txt>
              </Pressable>
            </Row>
            {/* this colleague's requests signed at once with the saved signature (off unless turned on here) */}
            <ToggleRow
              label={t("crew.autoApprove", { name: l.from })}
              hint={t("crew.autoApproveHint")}
              value={!!l.autoApprove}
              onChange={(on) => {
                if (on && !data.me.savedSignature)
                  return Alert.alert(t("mysig.title"), t("mysig.none"), [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("mysig.create"), onPress: () => router.push("/profile") },
                  ]);
                void act(`auto${l.id}`, { action: "autoApprove", linkId: l.id, on });
              }}
            />
            </View>
          ))}
        </Card>
      ) : null}
      <Txt variant="small" color={c.muted}>{t("crew.privacy")}</Txt>
      <View style={{ height: space.md }} />
    </Screen>
  );
}

type Act = (key: string, body: Record<string, unknown>, done?: (r: { status?: string }) => void) => Promise<void>;

function CaptainCard({ x, busy, act }: { x: Captain; busy: string | null; act: Act }) {
  const { t, locale, flights, session } = useApp();
  const c = useTheme();
  const [linkBusy, setLinkBusy] = useState(false);
  // unsigned flights of the last 90 days with this captain, for a signing link (signer without Geardown)
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const recent = flights.filter((f) => !f.deletedAt && !f.signatureId && f.date >= since && (f.picName ?? "").trim().toLowerCase() === x.name.trim().toLowerCase());
  const sendLink = async () => {
    setLinkBusy(true);
    try {
      const r = await createSignLink(session?.access_token, { flightIds: recent.map((f) => f.id), signerName: x.name, signerRole: "captain", locale });
      await Share.share({ message: t("crew.linkMessage", { n: r.flights, url: r.url }) });
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error && e.message === "plan" ? t("crew.err.plan") : t("sig.linkErr"));
    } finally {
      setLinkBusy(false);
    }
  };
  const [form, setForm] = useState(false);
  const [email, setEmail] = useState("");
  const [licence, setLicence] = useState("");
  const l = x.link;
  const send = (body: Record<string, unknown>) =>
    act(`l${x.name}`, { action: "link", name: x.name, ...body }, (r) => {
      if (r.status === "not_found") Alert.alert(t("crew.notFound"), t("crew.notFoundBody"));
      else setForm(false);
    });
  return (
    <Card>
      <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Txt style={{ fontWeight: "700", flex: 1 }}>{x.name}</Txt>
        {l?.status === "accepted" ? <Badge text={t("crew.linked")} color={c.success} /> : l?.status === "pending" ? <Badge text={t("crew.pending")} color={c.caution} /> : null}
      </Row>
      <Txt variant="small">{t("crew.flights", { n: x.flights, unsigned: x.unsigned, from: formatDate(x.oldest, locale), to: formatDate(x.latest, locale) })}</Txt>
      {l?.status === "accepted" ? (
        <>
          <Txt variant="small" color={c.success}>{t("crew.linkedTo", { name: l.account ?? "—" })}</Txt>
          <Txt variant="small">{t("crew.reqStats", l.requests)}</Txt>
          {x.unsigned > l.requests.pending ? (
            <Button kind="secondary" title={t("crew.askOlder", { n: x.unsigned - l.requests.pending })} loading={busy === `o${l.id}`} onPress={() => void act(`o${l.id}`, { action: "requestOlder", linkId: l.id })} />
          ) : null}
        </>
      ) : l?.status === "pending" ? (
        <Txt variant="small">{t("crew.waiting")}</Txt>
      ) : (
        <>
          {l?.status === "refused" ? <Txt variant="small" color={c.warning}>{t("crew.refused")}</Txt> : null}
          {x.match ? (
            <View style={{ gap: space.xs }}>
              <Row style={{ alignItems: "flex-start" }}>
                <Ionicons name="git-compare-outline" size={16} color={c.accent} style={{ marginTop: 2 }} />
                <Txt variant="small" style={{ flex: 1 }}>{t("crew.match", { n: x.match.flights })}</Txt>
              </Row>
              <Button title={t("crew.matchSend")} loading={busy === `l${x.name}`} onPress={() => void send({ viaFlight: true })} />
            </View>
          ) : null}
          {form ? (
            <View style={{ gap: space.xs }}>
              <Field label={t("crew.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Field label={t("crew.licence")} value={licence} onChangeText={setLicence} autoCapitalize="characters" autoCorrect={false} hint={t("crew.idHint")} />
              <Button
                title={t("crew.send")}
                disabled={!email.includes("@") && licence.replace(/[^A-Za-z0-9]/g, "").length < 5}
                loading={busy === `l${x.name}`}
                onPress={() => void send(email.includes("@") ? { email } : { licence })}
              />
            </View>
          ) : (
            <Button kind="ghost" title={t("crew.linkById")} onPress={() => setForm(true)} />
          )}
          {recent.length ? <Button kind="ghost" title={t("crew.sendLinkN", { n: recent.length })} loading={linkBusy} onPress={() => void sendLink()} /> : null}
        </>
      )}
    </Card>
  );
}

/** The flights other pilots ask this pilot to sign: select, draw once, sign all of them. */
function ToSignCard({ items, me, token, onDone }: { items: ToSign[]; me: CrewData["me"]; token?: string; onDone: () => Promise<void> }) {
  const { t, locale, pilot } = useApp();
  const c = useTheme();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const [open, setOpen] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [name, setName] = useState(me.name);
  const [licence, setLicence] = useState(me.licence);
  const [busy, setBusy] = useState(false);
  const chosen = items.filter((i) => selected.has(i.id));
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));
  const hm = (iso: string | null) => (iso ? iso.slice(11, 16) : "");

  const sign = async (useSaved = false) => {
    setBusy(true);
    try {
      const items = chosen.map((i) => ({ id: i.id, hash: i.hash }));
      const r = await crewAction(token, useSaved ? { action: "sign", items, useSaved: true } : { action: "sign", items, image: signatureSvg(paths), signerName: name.trim(), licence: licence.trim() });
      tap("success");
      setOpen(false);
      setPaths([]);
      if (r.changed) Alert.alert(t("crew.changedTitle"), t("crew.changedBody", { n: r.changed }));
      await onDone();
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const refuse = () =>
    Alert.alert(t("crew.refuseTitle"), t("crew.refuseBody", { n: chosen.length }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("crew.refuse"),
        style: "destructive",
        onPress: () => void crewAction(token, { action: "refuse", ids: chosen.map((i) => i.id) }).then(onDone).catch(() => undefined),
      },
    ]);

  return (
    <Card>
      <Row style={{ alignItems: "center" }}>
        <Ionicons name="create-outline" size={18} color={c.accent} />
        <Txt variant="h2" style={{ flex: 1 }}>{t("crew.toSign", { n: items.length })}</Txt>
        <Pressable hitSlop={8} onPress={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}>
          <Txt variant="small" color={c.accent}>{selected.size === items.length ? t("crew.none") : t("crew.all")}</Txt>
        </Pressable>
      </Row>
      {items.map((i) => (
        <Pressable key={i.id} onPress={() => toggle(i.id)} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 4 }}>
          <Ionicons name={selected.has(i.id) ? "checkbox" : "square-outline"} size={20} color={selected.has(i.id) ? c.accent : c.muted} />
          <View style={{ flex: 1 }}>
            <Txt mono style={{ fontWeight: "600" }}>{`${i.flight.dep} → ${i.flight.arr}  ${i.flight.registration ?? ""}`}</Txt>
            <Txt variant="small">
              {[formatDate(i.flight.date, locale), i.flight.out && i.flight.in ? `${hm(i.flight.out)}–${hm(i.flight.in)} UTC` : "", formatDuration(i.flight.totalMin, pilot.timeDisplay), i.flight.type, i.from].filter(Boolean).join(" · ")}
            </Txt>
          </View>
          {i.inMyLogbook ? <Ionicons name="checkmark-done" size={16} color={c.success} /> : null}
        </Pressable>
      ))}
      <Txt variant="small">{t("crew.inLogbookHint")}</Txt>
      <Row gap={space.xs}>
        {me.savedSignature ? (
          <Button
            style={{ flex: 1 }}
            title={t("crew.signN", { n: chosen.length })}
            loading={busy}
            disabled={!chosen.length}
            onPress={() =>
              Alert.alert(t("crew.signN", { n: chosen.length }), t("mysig.confirmMany", { n: chosen.length, total: formatDuration(chosen.reduce((x, i) => x + i.flight.totalMin, 0), pilot.timeDisplay), name: me.name }), [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("mysig.sign"), onPress: () => void sign(true) },
              ])
            }
          />
        ) : (
          <Button style={{ flex: 1 }} title={t("crew.signN", { n: chosen.length })} disabled={!chosen.length} onPress={() => setOpen(true)} />
        )}
        <Button style={{ flex: 1 }} kind="secondary" title={t("crew.refuse")} disabled={!chosen.length} onPress={refuse} />
      </Row>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, gap: space.sm }} scrollEnabled={false}>
          <Txt variant="h2">{t("crew.signN", { n: chosen.length })}</Txt>
          <Txt variant="small">{t("crew.signHint")}</Txt>
          <Field label={t("sig.name")} value={name} onChangeText={setName} />
          <Field label={t("sig.licence")} value={licence} onChangeText={setLicence} autoCapitalize="characters" />
          <Txt variant="label">{t("sig.draw")}</Txt>
          <SignaturePad onChange={setPaths} />
          <Button title={t("crew.signN", { n: chosen.length })} loading={busy} disabled={!paths.length || !name.trim()} onPress={() => void sign()} />
          <Button kind="ghost" title={t("common.cancel")} onPress={() => setOpen(false)} />
        </ScrollView>
      </Modal>
    </Card>
  );
}
