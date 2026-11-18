import React, { createContext, useContext, useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Roll } from "./Roll";
import { BlurView } from "expo-blur";
import { font, glass, mono, radius, space, useTheme, type Palette } from "../theme";

/** The photo behind every screen (as on the web app), with the theme's shade over it. */
export function Backdrop() {
  const c = useTheme();
  // portrait phone: the portrait framing; iPad, the unfolded iPhone Duo, landscape: the wide frame
  const { width, height } = useWindowDimensions();
  const wide = width > height * 0.8;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ImageBackground source={wide ? require("../../assets/backdrop-wide.jpg") : require("../../assets/backdrop.jpg")} resizeMode="cover" style={StyleSheet.absoluteFill} />
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
    // iOS type scale: large title, headline, body, footnote, caption
    title: { fontSize: 34, ...font.bold, color: c.text, letterSpacing: 0.2 },
    h2: { fontSize: 17, ...font.semibold, color: c.text, letterSpacing: -0.2 },
    body: { fontSize: 16, ...font.regular, color: c.text, letterSpacing: -0.2 },
    muted: { fontSize: 15, ...font.regular, color: c.muted, letterSpacing: -0.2 },
    label: { fontSize: 13, ...font.medium, color: c.muted },
    small: { fontSize: 13, ...font.regular, color: c.muted },
  }[variant] as TextStyle;
  return (
    <Text numberOfLines={numberOfLines} style={[base, isMono && mono, color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

/** Large screens (iPad, the unfolded iPhone Duo, landscape): content in two columns or kept to a readable width. */
export const WIDE = 700;
export const useWide = () => useWindowDimensions().width >= WIDE;

export function Screen({ children, scroll = true, style, backdrop, columns }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; backdrop?: boolean; columns?: boolean }) {
  const wide = useWide();
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
        <Screen style={style} columns={columns}>{children}</Screen>
      </View>
    );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "transparent" }}
      contentContainerStyle={[
        { padding: space.lg, gap: space.lg, paddingBottom: 130 },
        // a readable width on a large screen (two columns get more room)
        wide ? { width: "100%", maxWidth: columns ? 1180 : 760, alignSelf: "center" } : null,
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {wide && columns ? (
        // two columns, blocks dealt left and right in screen order
        <View style={{ flexDirection: "row", gap: space.lg, alignItems: "flex-start" }}>
          {[0, 1].map((col) => (
            <View key={col} style={{ flex: 1, gap: space.lg }}>
              {React.Children.toArray(children)
                .filter(Boolean)
                .map((child, i) =>
                  i % 2 === col ? (
                    <Order.Provider key={i} value={i}>
                      {child}
                    </Order.Provider>
                  ) : null,
                )}
            </View>
          ))}
        </View>
      ) : (
        /* each block of the screen comes in a little after the previous one */
        React.Children.toArray(children).map((child, i) => (
          <Order.Provider key={i} value={i}>
            {child}
          </Order.Provider>
        ))
      )}
    </ScrollView>
  );
}

const Order = createContext(0);

/** Fades and slides a block in when it first appears, in screen order (capped so long lists stay quick). */
export function Appear({ children, style, delay }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const order = useContext(Order);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay: delay ?? Math.min(order, 8) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, order, delay]);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>{children}</Animated.View>;
}

/** Slight shrink while pressed, back with a spring: the touch feels physical. */
function usePressScale(to = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  return {
    scale,
    onPressIn: () => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start(),
    onPressOut: () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start(),
  };
}

export const tap = (kind: "light" | "medium" | "success" = "light") => {
  if (kind === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else void Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const press = usePressScale(0.98);
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (onPress)
    return (
      <Appear>
        <Pressable onPress={() => (tap(), onPress())} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
          <Animated.View style={{ transform: [{ scale: press.scale }] }}>
            <Glass>{inner}</Glass>
          </Animated.View>
        </Pressable>
      </Appear>
    );
  return (
    <Appear>
      <Glass>{inner}</Glass>
    </Appear>
  );
}

/** iOS-style grouped list: a titled glass block of menu rows. */
export function MenuGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const c = useTheme();
  const rows = React.Children.toArray(children);
  return (
    <Appear>
      <View style={{ gap: 6 }}>
        {title ? <Txt variant="label" style={{ marginLeft: 14, textTransform: "uppercase", letterSpacing: 0.3, fontSize: 12.5 }}>{title}</Txt> : null}
        <Glass>
          {rows.map((r, i) => (
            <View key={i}>
              {i ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: glass(c).edge, marginLeft: 58 }} /> : null}
              {r}
            </View>
          ))}
        </Glass>
      </View>
    </Appear>
  );
}

/** A menu row: coloured icon tile, label, optional value, chevron. */
export function MenuRow({ icon, color, label, value, onPress, loading }: { icon: React.ReactNode; color: string; label: string; value?: string; onPress: () => void; loading?: boolean }) {
  const c = useTheme();
  return (
    <Pressable onPress={() => (tap(), onPress())} style={({ pressed }) => ({ backgroundColor: pressed ? glass(c).input : "transparent" })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 11 }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>{icon}</View>
        <Text style={{ flex: 1, color: c.text, fontSize: 16, letterSpacing: -0.2 }} numberOfLines={1}>{label}</Text>
        {loading ? <ActivityIndicator color={c.muted} /> : value ? <Text style={{ color: c.muted, fontSize: 15 }}>{value}</Text> : null}
        <Text style={{ color: c.muted, fontSize: 20, marginTop: -2 }}>›</Text>
      </View>
    </Pressable>
  );
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
  const press = usePressScale(0.97);
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || loading}
        onPress={() => {
          tap(kind === "primary" ? "medium" : "light");
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [
          styles.button,
          small && { paddingVertical: 7, paddingHorizontal: space.md },
          { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
          style,
        ]}
      >
        {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, ...font.semibold, fontSize: small ? 14 : 16, letterSpacing: -0.2 }}>{title}</Text>}
      </Pressable>
    </Animated.View>
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
          { color: c.text, backgroundColor: glass(c).input, borderColor: error ? c.warning : glass(c).edge, ...font.regular },
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
              onPress={() => (tap(), onChange(o.value))}
              style={[styles.segmentItem, on && { backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.14)" : "#FFFFFF" }]}
            >
              <Text style={[{ color: on ? c.text : c.muted, ...font.semibold, fontSize: 13 }]} numberOfLines={1}>
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
      onPress={() => (tap(), onChange(Math.max(0, value + d)))}
      style={[styles.stepBtn, { backgroundColor: glass(c).input }]}
    >
      <Text style={{ color: c.text, fontSize: 18, ...font.semibold }}>{txt}</Text>
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
      <Text style={{ color, fontSize: 12, ...font.semibold }}>{text}</Text>
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

export function Chip({ label, selected, onPress: press }: { label: string; selected?: boolean; onPress: () => void }) {
  const onPress = () => (tap(), press());
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? c.accent : glass(c).edge, backgroundColor: selected ? c.accent : glass(c).input }]}
    >
      <Text style={{ color: selected ? c.onAccent : c.text, fontSize: 13, ...font.medium }}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="label" numberOfLines={1}>
        {label}
      </Txt>
      <Roll text={value} size={24} color={color} style={{ ...font.regular, letterSpacing: -0.8 }} />
      {sub ? <Txt variant="small">{sub}</Txt> : null}
    </View>
  );
}

export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const c = useTheme();
  const press = usePressScale(0.9);
  // the main action pops in once the screen is drawn
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay: 250, useNativeDriver: true, speed: 12, bounciness: 10 }).start();
  }, [v]);
  return (
    <Animated.View style={[styles.fab, { backgroundColor: c.accent, transform: [{ scale: Animated.multiply(v, press.scale) }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => (tap("medium"), onPress())}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{ flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: c.onAccent, fontSize: 30, lineHeight: 32, ...font.regular }}>+</Text>
      </Pressable>
    </Animated.View>
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
    shadowColor: "#15803D",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
