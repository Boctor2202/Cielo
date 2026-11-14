import React from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { font, fontFor, glass, mono, radius, space, useTheme, type Palette } from "../theme";

/** The photo behind every screen (as on the web app), with the theme's shade over it. */
export function Backdrop() {
  const c = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ImageBackground source={require("../../assets/backdrop.jpg")} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glass(c).shade }]} />
    </View>
  );
}

/** Frosted glass surface (BlurView + tinted pane + light top edge). */
export function Glass({ children, style, strong, radius: r = radius.lg }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean; radius?: number }) {
  const c = useTheme();
  const g = glass(c);
  return (
    <View style={[{ borderRadius: r, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: g.edge }, style]}>
      <BlurView tint={g.tint} intensity={g.intensity} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: strong ? g.strong : g.pane }]} />
      {children}
    </View>
  );
}

type TxtVariant = "title" | "h2" | "body" | "muted" | "label" | "small";

export function Txt({
  children,
  variant = "body",
  mono: isMono,
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: TxtVariant;
  mono?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useTheme();
  const base: TextStyle = {
    title: { fontSize: 32, fontFamily: font.regular, color: c.text, letterSpacing: -1.1 },
    h2: { fontSize: 16, fontFamily: font.semibold, color: c.text, letterSpacing: -0.3 },
    body: { fontSize: 15, fontFamily: font.regular, color: c.text },
    muted: { fontSize: 14, fontFamily: font.regular, color: c.muted },
    label: { fontSize: 12.5, fontFamily: font.medium, color: c.muted },
    small: { fontSize: 12, fontFamily: font.regular, color: c.muted },
  }[variant] as TextStyle;
  // a custom font is chosen per weight: map any fontWeight given by a screen to the matching Manrope file
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const weighted = flat?.fontWeight ? { fontFamily: fontFor(flat.fontWeight), fontWeight: undefined } : null;
  return (
    <Text numberOfLines={numberOfLines} style={[base, isMono && mono, color ? { color } : null, style, weighted]}>
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = true, style, backdrop }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; backdrop?: boolean }) {
  if (!scroll)
    return (
      <View style={[{ flex: 1, backgroundColor: "transparent" }, style]}>
        {backdrop ? <Backdrop /> : null}
        {children}
      </View>
    );
  if (backdrop)
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Screen style={style}>{children}</Screen>
      </View>
    );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "transparent" }}
      contentContainerStyle={[{ padding: space.lg, gap: space.lg, paddingBottom: 130 }, style]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.75 }}>
        <Glass>{inner}</Glass>
      </Pressable>
    );
  return <Glass>{inner}</Glass>;
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

type ButtonKind = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  title,
  onPress,
  kind = "primary",
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const c = useTheme();
  const bg = { primary: c.accent, secondary: glass(c).input, danger: "transparent", ghost: "transparent" }[kind];
  const fg = { primary: c.onAccent, secondary: c.text, danger: c.warning, ghost: c.accent }[kind];
  const border = kind === "danger" ? c.warning : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && { paddingVertical: 6, paddingHorizontal: space.md },
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontFamily: font.semibold, fontSize: small ? 13 : 15 }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  monoValue,
  style,
  error,
  ...input
}: TextInputProps & { label?: string; hint?: string; monoValue?: boolean; error?: boolean }) {
  const c = useTheme();
  return (
    <View style={[{ gap: 4 }, style as StyleProp<ViewStyle>]}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={c.muted}
        {...input}
        style={[
          styles.input,
          { color: c.text, backgroundColor: glass(c).input, borderColor: error ? c.warning : glass(c).edge, fontFamily: font.regular },
          monoValue && mono,
          input.multiline && { minHeight: 80, textAlignVertical: "top" },
        ]}
      />
      {hint ? <Txt variant="small">{hint}</Txt> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      <View style={[styles.segment, { backgroundColor: glass(c).input }]}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.segmentItem, on && { backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.14)" : "#FFFFFF" }]}
            >
              <Text style={[{ color: on ? c.text : c.muted, fontFamily: font.semibold, fontSize: 13 }]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const c = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", minHeight: 40 }}>
      <View style={{ flex: 1 }}>
        <Txt>{label}</Txt>
        {hint ? <Txt variant="small">{hint}</Txt> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.surface2 }} thumbColor="#FFFFFF" />
    </Row>
  );
}

export function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const c = useTheme();
  const btn = (txt: string, d: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${txt}`}
      onPress={() => onChange(Math.max(0, value + d))}
      style={[styles.stepBtn, { backgroundColor: glass(c).input }]}
    >
      <Text style={{ color: c.text, fontSize: 18, fontFamily: font.semibold }}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 4, alignItems: "center", flex: 1 }}>
      <Txt variant="small" numberOfLines={1}>
        {label}
      </Txt>
      <Row gap={6}>
        {btn("−", -1)}
        <Txt mono style={{ minWidth: 24, textAlign: "center", fontSize: 17 }}>
          {value}
        </Txt>
        {btn("+", 1)}
      </Row>
    </View>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontFamily: font.semibold }}>{text}</Text>
    </View>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: space.xxl * 2, paddingHorizontal: space.xl, gap: space.sm }}>
      <Txt variant="h2" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {hint ? (
        <Txt variant="muted" style={{ textAlign: "center" }}>
          {hint}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? c.accent : glass(c).edge, backgroundColor: selected ? c.accent : glass(c).input }]}
    >
      <Text style={{ color: selected ? c.onAccent : c.text, fontSize: 13, fontFamily: font.medium }}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="label" numberOfLines={1}>
        {label}
      </Txt>
      <Txt mono style={{ fontSize: 24, fontFamily: font.regular, letterSpacing: -0.8 }} color={color}>
        {value}
      </Txt>
      {sub ? <Txt variant="small">{sub}</Txt> : null}
    </View>
  );
}

export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={{ color: c.onAccent, fontSize: 30, lineHeight: 32, fontFamily: font.regular }}>+</Text>
    </Pressable>
  );
}

export const statusColor = (c: Palette, state: "valid" | "expiring" | "expired" | "no_expiry" | "ok" | "warning" | "error") =>
  ({ valid: c.success, ok: c.success, expiring: c.caution, warning: c.caution, expired: c.warning, error: c.warning, no_expiry: c.muted })[
    state
  ];

const styles = StyleSheet.create({
  card: { padding: space.lg + 2, gap: space.md },
  button: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16 },
  segment: { flexDirection: "row", borderRadius: radius.md, padding: 3, gap: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: radius.sm + 1, alignItems: "center" },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  fab: {
    position: "absolute",
    right: space.xl,
    bottom: 104,
    width: 58,
    height: 58,
    borderRadius: 29,
    shadowColor: "#0E7490",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
