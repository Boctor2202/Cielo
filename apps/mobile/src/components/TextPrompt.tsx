import React, { useCallback, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, View, type KeyboardTypeOptions } from "react-native";
import { useTheme } from "../theme";
import { Button, Field, Glass, Row, Txt } from "./ui";

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  okLabel: string;
  cancelLabel: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "characters" | "words" | "sentences";
}

/**
 * A one-line text question: the native Alert.prompt on iOS, the same question in a small sheet on Android
 * (Alert.prompt does nothing there). `ask` resolves with the text, or null when cancelled.
 */
export function usePrompt(): { node: React.ReactNode; ask: (o: PromptOptions) => Promise<string | null> } {
  const [open, setOpen] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState("");
  const done = useRef<(v: string | null) => void>(() => {});

  const ask = useCallback((o: PromptOptions) => {
    if (Platform.OS === "ios") {
      return new Promise<string | null>((resolve) =>
        Alert.prompt(
          o.title,
          o.message,
          [
            { text: o.cancelLabel, style: "cancel", onPress: () => resolve(null) },
            { text: o.okLabel, onPress: (v?: string) => resolve(v ?? "") },
          ],
          "plain-text",
          o.defaultValue ?? "",
          o.keyboardType === "numbers-and-punctuation" ? "numbers-and-punctuation" : "default",
        ),
      );
    }
    return new Promise<string | null>((resolve) => {
      done.current = resolve;
      setValue(o.defaultValue ?? "");
      setOpen(o);
    });
  }, []);

  const close = (v: string | null) => {
    setOpen(null);
    done.current(v);
  };

  const node = open ? <Sheet o={open} value={value} onChange={setValue} onClose={close} /> : null;
  return { node, ask };
}

function Sheet({ o, value, onChange, onClose }: { o: PromptOptions; value: string; onChange: (v: string) => void; onClose: (v: string | null) => void }) {
  const c = useTheme();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => onClose(null)} statusBarTranslucent>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <Pressable onPress={() => onClose(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <Pressable onPress={() => {}}>
            <Glass strong style={{ padding: 18, gap: 12, backgroundColor: c.bg }}>
              <Txt variant="h2">{o.title}</Txt>
              {o.message ? <Txt variant="small">{o.message}</Txt> : null}
              <Field
                autoFocus
                value={value}
                onChangeText={onChange}
                keyboardType={o.keyboardType === "numbers-and-punctuation" ? "numeric" : o.keyboardType}
                autoCapitalize={o.autoCapitalize ?? "sentences"}
                onSubmitEditing={() => onClose(value)}
              />
              <Row style={{ justifyContent: "flex-end" }}>
                <Button small kind="ghost" title={o.cancelLabel} onPress={() => onClose(null)} />
                <Button small title={o.okLabel} onPress={() => onClose(value)} />
              </Row>
            </Glass>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
