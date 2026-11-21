import React from "react";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CV_THEMES, type CvDocument, type CvTheme } from "@cielo/cv";
import { useApp } from "../state";
import { Button, Txt } from "./ui";

const INK = "#16202C";
const MUTED = "#5B6878";
const RULE = "#DCE2E9";

/**
 * The CV as recruiters will see it, on a white page in the chosen theme: drawn from the same document as the
 * PDF (same sections, order, figures and wording), so what is read here is what the PDF holds.
 */
export function CvPreview({ open, onClose, doc, theme = "navy", photo, onShare, busy }: { open: boolean; onClose: () => void; doc: CvDocument; theme?: CvTheme; photo?: string; onShare: () => void; busy: boolean }) {
  const { t } = useApp();
  const { width } = useWindowDimensions();
  const c = CV_THEMES[theme] ?? CV_THEMES.navy;
  const page = Math.min(width - 24, 620);
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#D9DEE5" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <Txt color={INK} style={{ fontSize: 17, fontWeight: "700" }}>{t("cv.preview")}</Txt>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("common.close")}>
            <Ionicons name="close" size={24} color={INK} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 120 }}>
          <View style={{ width: page, backgroundColor: "#fff", borderRadius: 6, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
            {/* the band: name, headline, photo */}
            <View style={{ backgroundColor: c.dark, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
              {photo ? <Image source={{ uri: photo }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "#ffffff55" }} /> : null}
              <View style={{ flex: 1 }}>
                <Txt color="#fff" style={{ fontSize: 22, fontWeight: "800" }}>{doc.name}</Txt>
                {doc.headline ? <Txt color="#ffffffcc" style={{ fontSize: 13, marginTop: 2 }}>{doc.headline}</Txt> : null}
              </View>
            </View>
            {/* the headline figures */}
            {doc.figures.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", backgroundColor: c.tint, paddingVertical: 10, paddingHorizontal: 8 }}>
                {doc.figures.map((f) => (
                  <View key={f.label} style={{ width: "33.33%", paddingVertical: 4, alignItems: "center" }}>
                    <Txt color={c.dark} style={{ fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{f.value}</Txt>
                    <Txt color={MUTED} style={{ fontSize: 10 }}>{f.label}</Txt>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={{ padding: 18, gap: 16 }}>
              {doc.sections.map((s) => (
                <View key={s.id} style={{ gap: 6 }}>
                  <Txt color={c.accent} style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>{s.heading}</Txt>
                  <View style={{ height: 1.5, backgroundColor: c.accent, opacity: 0.35, marginBottom: 2 }} />
                  {s.lines.map((l, i) =>
                    l.kind === "pair" ? (
                      <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: RULE }}>
                        <Txt color={MUTED} style={{ fontSize: 12, flex: 1 }}>{l.label}</Txt>
                        <Txt color={INK} style={{ fontSize: 12, fontWeight: l.strong ? "800" : "600", fontVariant: ["tabular-nums"], textAlign: "right", flexShrink: 1 }}>{l.value}</Txt>
                      </View>
                    ) : l.kind === "item" ? (
                      <View key={i} style={{ gap: 2, paddingVertical: 3 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                          <Txt color={INK} style={{ fontSize: 13, fontWeight: "700", flex: 1 }}>{l.title}</Txt>
                          {l.value ? <Txt color={c.dark} style={{ fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{l.value}</Txt> : l.when ? <Txt color={MUTED} style={{ fontSize: 11 }}>{l.when}</Txt> : null}
                        </View>
                        {l.meta ? <Txt color={MUTED} style={{ fontSize: 11.5 }}>{[l.meta, l.value && l.when ? l.when : ""].filter(Boolean).join(" · ")}</Txt> : null}
                        {l.ratio !== undefined ? (
                          <View style={{ height: 4, borderRadius: 2, backgroundColor: c.tint, marginTop: 2 }}>
                            <View style={{ width: `${Math.max(3, l.ratio * 100)}%`, height: 4, borderRadius: 2, backgroundColor: c.accent }} />
                          </View>
                        ) : null}
                        {l.bullets?.map((b, k) => (
                          <Txt key={k} color={INK} style={{ fontSize: 12, lineHeight: 17 }}>•  {b}</Txt>
                        ))}
                      </View>
                    ) : (
                      <Txt key={i} color={INK} style={{ fontSize: 12.5, lineHeight: 18 }}>{l.text}</Txt>
                    ),
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 30 }}>
          <Button title={t("cv.share")} loading={busy} onPress={onShare} />
        </View>
      </View>
    </Modal>
  );
}
