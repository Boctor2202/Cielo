/**
 * Authentication (Supabase): e-mail magic link, Sign in with Apple, Google.
 * When EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are absent the app runs in
 * "local mode": `supabase` is null, every function here is a no-op and the UI hides sign-in.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;

export const isCloudEnabled = supabase !== null;

/** Deep link the auth provider redirects to: sillage://auth-callback */
export const authRedirectUrl = () => Linking.createURL("auth-callback");

function requireClient(): SupabaseClient {
  if (!supabase) throw new Error("Supabase is not configured (local mode).");
  return supabase;
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Completes a PKCE redirect (magic link or OAuth) from the `code` query parameter. */
export async function completeAuthFromUrl(link: string): Promise<Session | null> {
  const client = requireClient();
  const parsed = Linking.parse(link);
  const params = parsed.queryParams ?? {};
  const err = params.error_description ?? params.error;
  if (err) throw new Error(String(err));
  const code = params.code;
  if (typeof code === "string") {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }
  // Implicit-flow fallback: tokens in the fragment.
  const hash = link.split("#")[1];
  if (hash) {
    const h = new URLSearchParams(hash);
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");
    if (access_token && refresh_token) {
      const { data, error } = await client.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      return data.session;
    }
  }
  return null;
}

async function signInWithOAuth(provider: "google" | "apple"): Promise<Session | null> {
  const client = requireClient();
  const redirectTo = authRedirectUrl();
  const { data, error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== "success") return null;
  return completeAuthFromUrl(res.url);
}

export const signInWithGoogle = () => signInWithOAuth("google");

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (!supabase) return false;
  if (Platform.OS === "android") return true; // web OAuth flow
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Native Sign in with Apple on iOS (ID token + nonce), web OAuth elsewhere. */
export async function signInWithApple(): Promise<Session | null> {
  if (Platform.OS !== "ios") return signInWithOAuth("apple");
  const client = requireClient();
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error("No identity token returned by Apple.");
    const { data, error } = await client.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
    if (error) throw error;
    return data.session;
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
