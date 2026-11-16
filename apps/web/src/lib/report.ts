"use client";

import { supabase } from "./supabase";

/** Authenticated fetch to the Geardown API (Bearer = Supabase access token when signed in). */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers });
}

const version = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

export async function sendReport(kind: "bug" | "idea" | "error", message: string, context: Record<string, unknown> = {}) {
  const r = await apiFetch("/api/report", {
    method: "POST",
    body: JSON.stringify({
      kind,
      message,
      page: location.pathname,
      platform: "web",
      appVersion: version,
      context: { ...context, screen: `${innerWidth}×${innerHeight}`, lang: navigator.language, online: navigator.onLine },
    }),
  });
  if (!r.ok) throw new Error(String(r.status));
}

let installed = false;
/** Sends uncaught client errors to the admin back office (each distinct error once per session, at most 5). */
export function installErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const seen = new Set<string>();
  const send = (message: string, stack?: string) => {
    if (!message || seen.size >= 5 || seen.has(message)) return;
    // noise from extensions and aborted requests
    if (/ResizeObserver loop|Script error\.|AbortError|chrome-extension:|moz-extension:/.test(message + (stack ?? ""))) return;
    seen.add(message);
    void sendReport("error", message.slice(0, 500), { stack: stack?.slice(0, 2000) }).catch(() => undefined);
  };
  window.addEventListener("error", (e) => send(e.message, e.error?.stack));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string; stack?: string } | string | undefined;
    send(typeof r === "string" ? r : (r?.message ?? "Unhandled rejection"), typeof r === "string" ? undefined : r?.stack);
  });
}
