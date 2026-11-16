/**
 * RevenueCat (react-native-purchases) wrapper. Keys come from EXPO_PUBLIC_REVENUECAT_IOS_KEY /
 * EXPO_PUBLIC_REVENUECAT_ANDROID_KEY; without a key for the current platform every call is a
 * graceful no-op and the subscription screen shows "not configured".
 * The module is imported lazily so a missing native module (e.g. Expo Go) never crashes the app.
 */
import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

/** RevenueCat entitlements: "premium" = Max, "basic" = Basic (same ids as the webhook). */
export const ENTITLEMENT_ID = "premium";
export const BASIC_ENTITLEMENT_ID = "basic";

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

export const isPurchasesEnabled = !!apiKey;

let configured: Promise<typeof import("react-native-purchases").default | null> | null = null;

async function client() {
  if (!apiKey) return null;
  configured ??= import("react-native-purchases")
    .then((m) => {
      m.default.configure({ apiKey });
      return m.default;
    })
    .catch((e) => {
      console.warn("[purchases] RevenueCat unavailable", e);
      return null;
    });
  return configured;
}

export async function identify(appUserId: string): Promise<void> {
  const p = await client();
  if (p) await p.logIn(appUserId).catch(() => undefined);
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  const p = await client();
  if (!p) return [];
  const offerings = await p.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export const isPremium = (info: CustomerInfo | null | undefined) => !!info?.entitlements.active[ENTITLEMENT_ID];

/** Plan granted by the store right now. */
export function tierOf(info: CustomerInfo | null | undefined): { tier: "premium" | "basic" | null; store?: string; expires?: string | null } {
  const e = info?.entitlements.active;
  const ent = e?.[ENTITLEMENT_ID] ?? e?.[BASIC_ENTITLEMENT_ID];
  if (!ent) return { tier: null };
  return { tier: e?.[ENTITLEMENT_ID] ? "premium" : "basic", store: ent.store, expires: ent.expirationDate };
}

/** Which plan a store package sells: product or package id containing "max"/"premium" → Max, "basic" → Basic. */
export function planOf(pkg: PurchasesPackage): "premium" | "basic" | null {
  const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  if (/max|premium/.test(id)) return "premium";
  if (/basic/.test(id)) return "basic";
  return null;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const p = await client();
  return p ? p.getCustomerInfo() : null;
}

export async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  const p = await client();
  if (!p) return null;
  const res = await p.purchasePackage(pkg);
  return res.customerInfo;
}

export async function restore(): Promise<CustomerInfo | null> {
  const p = await client();
  return p ? p.restorePurchases() : null;
}
