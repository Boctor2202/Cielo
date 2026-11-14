import React, { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { Screen, Txt } from "../src/components/ui";
import { completeAuthFromUrl, isCloudEnabled } from "../src/auth";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";

/** Deep link target of the magic link / OAuth redirect: cielo://auth-callback?code=… */
export default function AuthCallback() {
  const { t } = useApp();
  const c = useTheme();
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !isCloudEnabled) return;
    completeAuthFromUrl(url)
      .then(() => router.replace("/more"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [url]);

  return (
    <Screen backdrop>
      {error ? <Txt color={c.warning}>{`${t("auth.failed")}: ${error}`}</Txt> : <Txt variant="muted">{t("auth.completing")}</Txt>}
      {!error ? <ActivityIndicator color={c.accent} /> : null}
    </Screen>
  );
}
