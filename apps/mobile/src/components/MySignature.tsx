import React, { useState } from "react";
import { Alert, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Signature } from "@cielo/core";
import type { I18nKey } from "../i18n";
import { todayUtc, useApp } from "../state";
import { useTheme } from "../theme";
import { Button, Card, Chip, Row, ToggleRow, Txt, tap } from "./ui";
import { SignatureImage, SignaturePad, signatureSvg } from "./SignaturePad";

const ROLES: Signature["signerRole"][] = ["captain", "instructor", "examiner", "other"];

/**
 * Profile › My signature: drawn once, kept on the pilot's account (synced with the website), then used to sign
 * their own flights, their colleagues' requests, and the logbook when it is exported.
 */
export function MySignature() {
  const app = useApp();
  const { t, pilot, access } = app;
  const c = useTheme();
  const [drawing, setDrawing] = useState(!pilot.signatureDataUrl);
  const [paths, setPaths] = useState<string[]>([]);
  const [pad, setPad] = useState(0);
  if (!access.has("signature")) return null;

  const save = async () => {
    await app.savePilot({ signatureDataUrl: signatureSvg(paths), signatureRole: pilot.signatureRole ?? "captain" });
    tap("success");
    setDrawing(false);
    setPaths([]);
  };
  const remove = () =>
    Alert.alert(t("mysig.remove"), t("mysig.removeBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("mysig.remove"), style: "destructive", onPress: () => void app.savePilot({ signatureDataUrl: undefined, autoSignFrom: null }).then(() => setDrawing(true)) },
    ]);

  return (
    <Card>
      <Row style={{ alignItems: "center" }}>
        <Ionicons name="create-outline" size={18} color={c.accent} />
        <Txt variant="h2" style={{ flex: 1 }}>{t("mysig.title")}</Txt>
      </Row>
      <Txt variant="small">{t("mysig.hint")}</Txt>
      {drawing ? (
        <>
          <SignaturePad key={pad} onChange={setPaths} />
          <Row gap={8}>
            <Button style={{ flex: 1 }} kind="secondary" title={t("sig.clear")} onPress={() => (setPaths([]), setPad((k) => k + 1))} />
            <Button style={{ flex: 1 }} title={t("mysig.save")} disabled={!paths.length || !pilot.fullName?.trim()} onPress={() => void save()} />
          </Row>
          {!pilot.fullName?.trim() ? <Txt variant="small" color={c.caution}>{t("mysig.needName")}</Txt> : null}
          {pilot.signatureDataUrl ? <Button kind="ghost" small title={t("common.cancel")} onPress={() => setDrawing(false)} /> : null}
        </>
      ) : (
        <>
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 6 }}>
            <SignatureImage dataUrl={pilot.signatureDataUrl!} />
          </View>
          <Txt variant="small">{[pilot.fullName, pilot.licenceNumber].filter(Boolean).join(" · ")}</Txt>
          <Txt variant="label">{t("mysig.role")}</Txt>
          <Row style={{ flexWrap: "wrap" }} gap={6}>
            {ROLES.map((r) => (
              <Chip key={r} label={t(`sig.role.${r}` as I18nKey)} selected={(pilot.signatureRole ?? "captain") === r} onPress={() => void app.savePilot({ signatureRole: r })} />
            ))}
          </Row>
          <ToggleRow
            label={t("mysig.auto")}
            hint={t("mysig.autoHint")}
            value={!!pilot.autoSignFrom}
            onChange={(v) => void app.savePilot({ autoSignFrom: v ? todayUtc() : null })}
          />
          <Row gap={8}>
            <Button style={{ flex: 1 }} kind="secondary" title={t("mysig.redraw")} onPress={() => setDrawing(true)} />
            <Button style={{ flex: 1 }} kind="ghost" title={t("mysig.remove")} onPress={remove} />
          </Row>
        </>
      )}
    </Card>
  );
}
