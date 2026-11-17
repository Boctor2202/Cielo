import React from "react";
import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, lineLimit, monospacedDigit, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

/**
 * "Flight day" Live Activity (Lock Screen and Dynamic Island): from the report time to the end of the duty, it
 * shows the next leg and counts down the time left before the maximum FDP and before release. Times are epoch ms.
 */
export type DutyProps = {
  /** "AFR123 LFPB → LFMN" or the duty title */
  leg: string;
  /** departure of that leg (ms) */
  std?: number;
  reportAt: number;
  /** end of the maximum FDP (ms) */
  fdpEnd: number;
  releaseAt: number;
  sectors: number;
  l: { fdpLeft: string; next: string; report: string; sectors: string; done: string };
};

const DutyActivity = (p: DutyProps, env: LiveActivityEnvironment) => {
  "widget";
  const ACCENT = env.isLuminanceReduced ? "#FFFFFF" : "#22C55E";
  const MUTED = "#93A6BC";
  const start = new Date(p.reportAt);
  const end = new Date(p.fdpEnd);
  const timer = (size: number) => (
    <Text timerInterval={{ lower: start, upper: end }} countsDown modifiers={[font({ size, weight: "bold", design: "monospaced" }), monospacedDigit(), foregroundStyle(ACCENT)]} />
  );
  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={6}>
          <Image systemName="airplane" size={13} color={ACCENT} />
          <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(ACCENT)]}>GEARDOWN</Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{`${p.l.report} `}</Text>
          <Text date={start} dateStyle="time" modifiers={[font({ size: 12, design: "monospaced" }), foregroundStyle(MUTED)]} />
        </HStack>
        <HStack alignment="bottom">
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{p.l.next}</Text>
            <Text modifiers={[font({ size: 16, weight: "semibold", design: "monospaced" }), lineLimit(1)]}>{p.leg}</Text>
            {p.std ? <Text date={new Date(p.std)} dateStyle="time" modifiers={[font({ size: 13, design: "monospaced" }), foregroundStyle(MUTED)]} /> : null}
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={2}>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{p.l.fdpLeft}</Text>
            {timer(26)}
          </VStack>
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName="airplane" color={ACCENT} />,
    compactTrailing: timer(14),
    minimal: <Image systemName="airplane" color={ACCENT} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 6 })]}>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{p.l.next}</Text>
        <Text modifiers={[font({ size: 15, weight: "semibold", design: "monospaced" }), lineLimit(1)]}>{p.leg}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ trailing: 6 })]}>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{p.l.fdpLeft}</Text>
        {timer(20)}
      </VStack>
    ),
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 6 })]}>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{`${p.l.report} `}</Text>
        <Text date={start} dateStyle="time" modifiers={[font({ size: 12, design: "monospaced" }), foregroundStyle(MUTED)]} />
        <Spacer />
        <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{p.l.sectors}</Text>
      </HStack>
    ),
  };
};

export default createLiveActivity<DutyProps>("DutyDay", DutyActivity);
