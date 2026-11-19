import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { PRICES_EUR, YEARLY_PRICES_EUR } from "@cielo/core";
import { router } from "expo-router";
import { Badge, Button, Card, Row, Screen, Segmented, Txt } from "../src/components/ui";
import { CancelledNotice } from "../src/components/CancelledNotice";
import { useCancelledUntil } from "../src/subscriptionStatus";
import { getCustomerInfo, getPackages, isPurchasesEnabled, planOf, purchase, restore, tierOf } from "../src/purchases";
import { API_URL } from "../src/api";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";

type Plan = "basic" | "premium";
type Interval = "monthly" | "yearly";

/** A yearly store package: RevenueCat's annual type, or an id that says so. */
const isYearly = (p: PurchasesPackage) => p.packageType === "ANNUAL" || /annual|year|yearly|_y\b/i.test(`${p.identifier} ${p.product.identifier}`);

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
  const [interval, setInterval] = useState<Interval>("yearly");
  const endsAt = useCancelledUntil();
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

  const money = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: "EUR" }).format(n);
  const fallbackPrice = (p: Plan) => money(interval === "yearly" ? YEARLY_PRICES_EUR[p] : PRICES_EUR[p]);
  /** The monthly equivalent of a yearly plan: the App Store's own figure (in the pilot's currency), else the website's price / 12. */
  const perMonth = (pkg: PurchasesPackage | undefined, plan: Plan) => {
    const p = pkg?.product;
    if (p?.pricePerMonthString) return p.pricePerMonthString;
    if (p && p.price > 0) {
      try {
        return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: p.currencyCode }).format(Math.floor((p.price / 12) * 100) / 100);
      } catch {
        /* unknown currency code: fall through */
      }
    }
    return money(Math.floor((YEARLY_PRICES_EUR[plan] / 12) * 100) / 100);
  };
  // a card subscription taken on the website: managed there, never bought a second time through the App Store
  const onWeb = !!current && pilot.subscriptionSource === "stripe";
  const plans: Plan[] = ["basic", "premium"];

  return (
    <Screen backdrop>
      <Txt variant="title">{t("sub.title")}</Txt>
      {endsAt ? <CancelledNotice endsAt={endsAt} /> : null}
      {onWeb ? (
        <Card>
          <Txt variant="small">{t("sub.stripeTaken")}</Txt>
          <Button kind="secondary" title={t("sub.stripeManage")} onPress={() => router.push("/account")} />
        </Card>
      ) : !isPurchasesEnabled ? (
        <Card>
          <Txt variant="h2">{t("sub.webTitle")}</Txt>
          <Txt variant="small">{t("sub.webBody")}</Txt>
          <Button title={t("sub.webButton")} onPress={() => void Linking.openURL(`${API_URL}/${locale}/app/parametres`)} />
        </Card>
      ) : packages === null ? (
        <Txt variant="muted">{t("sub.loading")}</Txt>
      ) : null}
      <Segmented<Interval>
        options={[
          { value: "monthly", label: t("sub.monthly") },
          { value: "yearly", label: t("sub.yearly") },
        ]}
        value={interval}
        onChange={setInterval}
      />
      {plans.map((plan) => {
        const pkg = packages?.find((p) => planOf(p) === plan && isYearly(p) === (interval === "yearly"));
        const price = pkg?.product.priceString ?? fallbackPrice(plan);
        const isCurrent = current === plan;
        return (
          <Card key={plan} style={{ borderWidth: 1.5, borderRadius: 20, borderColor: isCurrent ? c.success : plan === "premium" ? c.accent : "rgba(255,255,255,0.18)" }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt variant="h2" style={{ fontSize: 20 }}>{t(plan === "premium" ? "sub.max" : "sub.basic")}</Txt>
              {isCurrent ? <Badge text={t("sub.current")} color={c.success} /> : plan === "premium" ? <Badge text={t("sub.recommended")} color={c.accent} /> : null}
            </Row>
            <Txt mono style={{ fontSize: 30 }}>
              {price}
              <Txt variant="muted"> / {t(interval === "yearly" ? "sub.perYear" : "sub.perMonth")}</Txt>
            </Txt>
            {interval === "yearly" ? <Txt variant="small" color={c.accent}>{t("sub.yearlyEq", { price: perMonth(pkg, plan) })}</Txt> : null}
            <Txt variant="muted">{t(plan === "premium" ? "sub.maxPitch" : "sub.basicPitch")}</Txt>
            {!isCurrent && !onWeb && isPurchasesEnabled ? (
              <View style={{ gap: 6 }}>
                <Button
                  title={t("sub.choose")}
                  kind="primary"
                  disabled={!pkg}
                  loading={busy === plan}
                  onPress={() => pkg && run(plan, () => purchase(pkg))}
                />
                <Txt variant="small" style={{ textAlign: "center" }}>{t(interval === "yearly" ? "sub.trialYear" : "sub.trial", { price })}</Txt>
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
