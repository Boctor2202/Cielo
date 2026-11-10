import React from "react";
import {
  ActivityIndicator,
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
import { mono, radius, space, useTheme, type Palette } from "../theme";

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
    title: { fontSize: 28, fontWeight: "700", color: c.text, letterSpacing: -0.5 },
    h2: { fontSize: 17, fontWeight: "600", color: c.text },
    body: { fontSize: 15, color: c.text },
    muted: { fontSize: 14, color: c.muted },
    label: { fontSize: 12, fontWeight: "600", color: c.muted, textTransform: "uppercase", letterSpacing: 0.8 },
    small: { fontSize: 12, color: c.muted },
  }[variant] as TextStyle;
  return (
    <Text numberOfLines={numberOfLines} style={[base, isMono && mono, color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }, style]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useTheme();
  const s = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.7 }]}>
        {children}
      </Pressable>
    );
  return <View style={s}>{children}</View>;
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
  const bg = { primary: c.accent, secondary: c.surface2, danger: "transparent", ghost: "transparent" }[kind];
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
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: "600", fontSize: small ? 13 : 15 }}>{title}</Text>}
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
          { color: c.text, backgroundColor: c.bg, borderColor: error ? c.warning : c.border },
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
      <View style={[styles.segment, { backgroundColor: c.surface2 }]}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.segmentItem, on && { backgroundColor: c.accent }]}
            >
              <Text style={[{ color: on ? c.onAccent : c.text, fontWeight: "600", fontSize: 13 }]} numberOfLines={1}>
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
      style={[styles.stepBtn, { backgroundColor: c.surface2 }]}
    >
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>{txt}</Text>
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
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{text}</Text>
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
      style={[styles.chip, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accent : "transparent" }]}
    >
      <Text style={{ color: selected ? c.onAccent : c.text, fontSize: 13, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="label" numberOfLines={1}>
        {label}
      </Txt>
      <Txt mono style={{ fontSize: 20, fontWeight: "600" }} color={color}>
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
      <Text style={{ color: c.onAccent, fontSize: 30, lineHeight: 32, fontWeight: "400" }}>+</Text>
    </Pressable>
  );
}

export const statusColor = (c: Palette, state: "valid" | "expiring" | "expired" | "no_expiry" | "ok" | "warning" | "error") =>
  ({ valid: c.success, ok: c.success, expiring: c.caution, warning: c.caution, expired: c.warning, error: c.warning, no_expiry: c.muted })[
    state
  ];

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  button: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16 },
  segment: { flexDirection: "row", borderRadius: radius.md, padding: 3, gap: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: radius.sm, alignItems: "center" },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  fab: {
    position: "absolute",
    right: space.xl,
    bottom: space.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
