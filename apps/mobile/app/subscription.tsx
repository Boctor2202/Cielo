import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { Badge, Button, Card, Row, Screen, Txt } from "../src/components/ui";
import { getCustomerInfo, getPackages, isPremium, isPurchasesEnabled, purchase, restore } from "../src/purchases";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";

export default function Subscription() {
  const { t, pilot, savePilot } = useApp();
  const c = useTheme();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isPurchasesEnabled) return;
    getPackages().then(setPackages).catch(() => setPackages([]));
    getCustomerInfo().then(setInfo).catch(() => undefined);
  }, []);

  const apply = async (ci: CustomerInfo | null) => {
    if (!ci) return;
    setInfo(ci);
    if (isPremium(ci) && pilot.subscriptionTier !== "premium") {
      const ent = ci.entitlements.active.premium;
      await savePilot({
        subscriptionTier: "premium",
        subscriptionSource: ent?.store === "PLAY_STORE" ? "google" : "apple",
        subscriptionExpiresAt: ent?.expirationDate ?? null,
      });
      Alert.alert(t("sub.purchased"));
    }
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

  return (
    <Screen>
      <Txt variant="title">{t("sub.title")}</Txt>
      <Txt variant="muted">{t("sub.pitch")}</Txt>
      {isPremium(info) || pilot.subscriptionTier === "premium" ? (
        <Row>
          <Badge text={t("sub.active")} color={c.success} />
        </Row>
      ) : null}
      {!isPurchasesEnabled ? (
        <Card>
          <Txt variant="muted">{t("sub.unavailable")}</Txt>
        </Card>
      ) : packages === null ? (
        <Txt variant="muted">{t("sub.loading")}</Txt>
      ) : packages.length === 0 ? (
        <Txt variant="muted">{t("sub.noOffers")}</Txt>
      ) : (
        packages.map((p) => (
          <Card key={p.identifier}>
            <Txt variant="h2">{p.product.title}</Txt>
            <Txt variant="muted">{p.product.description}</Txt>
            <Button title={p.product.priceString} loading={busy === p.identifier} onPress={() => run(p.identifier, () => purchase(p))} />
          </Card>
        ))
      )}
      {isPurchasesEnabled ? <Button kind="ghost" title={t("sub.restore")} loading={busy === "restore"} onPress={() => run("restore", restore)} /> : null}
    </Screen>
  );
}
