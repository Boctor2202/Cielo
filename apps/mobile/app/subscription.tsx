import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { PRICES_EUR } from "@cielo/core";
import { Badge, Button, Card, Row, Screen, Txt } from "../src/components/ui";
import { getCustomerInfo, getPackages, isPurchasesEnabled, planOf, purchase, restore, tierOf } from "../src/purchases";
import { API_URL } from "../src/api";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";

type Plan = "basic" | "premium";

/**
 * Basic / Max with the 7-day free trial, sold by the App Store (or Google Play) through RevenueCat.
 * The store is the source of truth: the RevenueCat webhook updates the account on the server; the local
 * update below only shows the new plan at once.
 */
export default function Subscription() {
  const { t, pilot, savePilot, locale } = useApp();
  const c = useTheme();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const current: Plan | null = pilot.subscriptionTier === "premium" || pilot.subscriptionTier === "basic" ? pilot.subscriptionTier : null;

  useEffect(() => {
    if (!isPurchasesEnabled) return;
    getPackages().then(setPackages).catch(() => setPackages([]));
    getCustomerInfo().then((ci) => void apply(ci, false)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = async (ci: CustomerInfo | null, announce = true) => {
    const s = tierOf(ci);
    if (!s.tier || s.tier === pilot.subscriptionTier) return;
    await savePilot({ subscriptionTier: s.tier, subscriptionSource: s.store === "PLAY_STORE" ? "google" : "apple", subscriptionExpiresAt: s.expires ?? null });
    if (announce) Alert.alert(t("sub.purchased"));
  };

  const run = async (key: string, fn: () => Promise<CustomerInfo | null>) => {
    setBusy(key);
    try {
      await apply(await fn());
    } catch (e) {
      if (!(e as { userCancelled?: boolean }).userCancelled) Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const fallbackPrice = (p: Plan) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: "EUR" }).format(PRICES_EUR[p]);
  const plans: Plan[] = ["basic", "premium"];

  return (
    <Screen backdrop>
      <Txt variant="title">{t("sub.title")}</Txt>
      {!isPurchasesEnabled ? (
        <Card>
          <Txt variant="muted">{t("sub.unavailable")}</Txt>
        </Card>
      ) : packages === null ? (
        <Txt variant="muted">{t("sub.loading")}</Txt>
      ) : null}

      {plans.map((plan) => {
        const pkg = packages?.find((p) => planOf(p) === plan);
        const price = pkg?.product.priceString ?? fallbackPrice(plan);
        const isCurrent = current === plan;
        return (
          <Card key={plan} style={plan === "premium" ? { borderWidth: 1.5, borderColor: c.accent, borderRadius: 20 } : undefined}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt variant="h2" style={{ fontSize: 20 }}>{t(plan === "premium" ? "sub.max" : "sub.basic")}</Txt>
              {isCurrent ? <Badge text={t("sub.current")} color={c.success} /> : null}
            </Row>
            <Txt mono style={{ fontSize: 30 }}>
              {price}
              <Txt variant="muted"> / {locale === "fr" ? "mois" : "month"}</Txt>
            </Txt>
            <Txt variant="muted">{t(plan === "premium" ? "sub.maxPitch" : "sub.basicPitch")}</Txt>
            {!isCurrent ? (
              <View style={{ gap: 6 }}>
                <Button
                  title={t("sub.choose")}
                  kind={plan === "premium" ? "primary" : "secondary"}
                  disabled={!pkg}
                  loading={busy === plan}
                  onPress={() => pkg && run(plan, () => purchase(pkg))}
                />
                <Txt variant="small" style={{ textAlign: "center" }}>{t("sub.trial", { price })}</Txt>
              </View>
            ) : null}
          </Card>
        );
      })}

      {isPurchasesEnabled ? <Button kind="ghost" title={t("sub.restore")} loading={busy === "restore"} onPress={() => run("restore", restore)} /> : null}
      <Txt variant="small">{t("sub.legal")}</Txt>
      <Row style={{ justifyContent: "center" }} gap={16}>
        <Pressable onPress={() => void Linking.openURL(`${API_URL}/${locale === "fr" ? "fr/legal/cgu" : "en/legal/terms"}`)} hitSlop={8}>
          <Txt variant="small" color={c.accent}>{t("sub.terms")}</Txt>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(`${API_URL}/${locale === "fr" ? "fr/legal/confidentialite" : "en/legal/privacy"}`)} hitSlop={8}>
          <Txt variant="small" color={c.accent}>{t("sub.privacy")}</Txt>
        </Pressable>
      </Row>
    </Screen>
  );
}
