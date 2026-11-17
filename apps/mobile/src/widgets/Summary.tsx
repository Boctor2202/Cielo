import React from "react";
import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

/**
 * Home screen and Lock Screen widget: hours of the last 90 / 28 days, the next duty of the roster and the next
 * deadline (document or recency). All the text comes in the props, already translated by the app.
 */
export type SummaryProps = {
  h90: string;
  h28: string;
  m12: string;
  /** labels: "90 j", "28 j", "12 mois", "Prochain service", "Échéance" */
  l: { d90: string; d28: string; m12: string; next: string; due: string; none: string };
  /** next roster duty: route or title, start time (ms) */
  next?: { label: string; at: number };
  /** next deadline: "Licence TR C680", "dans 12 j", late or soon */
  due?: { label: string; when: string; level: "ok" | "soon" | "late" };
};

const Summary = (p: SummaryProps, env: WidgetEnvironment) => {
  "widget";
  const BG = "#0A1626";
  const ACCENT = "#22C55E";
  const MUTED = "#93A6BC";
  const WARN = p.due?.level === "late" ? "#F87171" : p.due?.level === "soon" ? "#FBBF24" : MUTED;
  const fam = env.widgetFamily;

  if (fam === "accessoryInline") {
    return <Text>{`✈︎ ${p.h90} · ${p.l.d90}`}</Text>;
  }
  if (fam === "accessoryRectangular") {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[containerBackground("clear", "widget")]}>
        <Text modifiers={[font({ size: 15, weight: "bold", design: "monospaced" })]}>{`${p.h90}  ${p.l.d90}`}</Text>
        {p.next ? <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{p.next.label}</Text> : null}
        {p.next ? <Text date={new Date(p.next.at)} dateStyle="relative" modifiers={[font({ size: 12 })]} /> : <Text modifiers={[font({ size: 12 })]}>{p.l.none}</Text>}
      </VStack>
    );
  }

  const hours = (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={4}>
        <Image systemName="airplane" size={11} color={ACCENT} />
        <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(ACCENT)]}>GEARDOWN</Text>
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: fam === "systemSmall" ? 30 : 34, weight: "bold", design: "monospaced" }), monospacedDigit(), foregroundStyle("#FFFFFF")]}>{p.h90}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{p.l.d90}</Text>
      <Text modifiers={[font({ size: 12, design: "monospaced" }), foregroundStyle(MUTED)]}>{`${p.h28} · ${p.l.d28}`}</Text>
    </VStack>
  );

  const nextBlock = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(MUTED)]}>{p.l.next}</Text>
      {p.next ? (
        <>
          <Text modifiers={[font({ size: 14, weight: "semibold", design: "monospaced" }), foregroundStyle("#FFFFFF"), lineLimit(1)]}>{p.next.label}</Text>
          <Text date={new Date(p.next.at)} dateStyle="relative" modifiers={[font({ size: 12 }), foregroundStyle(ACCENT)]} />
        </>
      ) : (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(MUTED)]}>{p.l.none}</Text>
      )}
    </VStack>
  );

  if (fam === "systemSmall") {
    return (
      <VStack alignment="leading" spacing={4} modifiers={[containerBackground(BG, "widget"), frame({ maxWidth: 9999, maxHeight: 9999, alignment: "topLeading" })]}>
        {hours}
        {p.next ? <Text modifiers={[font({ size: 11, design: "monospaced" }), foregroundStyle(ACCENT), lineLimit(1)]}>{p.next.label}</Text> : null}
      </VStack>
    );
  }

  return (
    <HStack alignment="top" spacing={14} modifiers={[containerBackground(BG, "widget")]}>
      <VStack alignment="leading" modifiers={[frame({ maxWidth: 9999, maxHeight: 9999, alignment: "topLeading" })]}>{hours}</VStack>
      <VStack alignment="leading" spacing={10} modifiers={[frame({ maxWidth: 9999, maxHeight: 9999, alignment: "topLeading" }), padding({ top: 2 })]}>
        {nextBlock}
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(MUTED)]}>{p.l.due}</Text>
          {p.due ? (
            <>
              <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle("#FFFFFF"), lineLimit(1)]}>{p.due.label}</Text>
              <Text modifiers={[font({ size: 12 }), foregroundStyle(WARN)]}>{p.due.when}</Text>
            </>
          ) : (
            <Text modifiers={[font({ size: 13 }), foregroundStyle(MUTED)]}>{p.l.none}</Text>
          )}
        </VStack>
      </VStack>
    </HStack>
  );
};

export default createWidget<SummaryProps>("GeardownSummary", Summary, {
  h90: "—",
  h28: "—",
  m12: "—",
  l: { d90: "90 d", d28: "28 d", m12: "12 m", next: "Next duty", due: "Deadline", none: "—" },
});
