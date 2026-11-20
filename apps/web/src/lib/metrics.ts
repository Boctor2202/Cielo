"use client";

import type { FunnelEvent } from "@cielo/core";

/** Counts a product step (event name only), when metrics are on and the browser does not ask not to be tracked. */
export function track(event: FunnelEvent) {
  if (process.env.NEXT_PUBLIC_METRICS !== "1" || typeof navigator === "undefined") return;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  if (n.globalPrivacyControl || n.doNotTrack === "1") return;
  try {
    void fetch("/api/metrics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, platform: "web" }), keepalive: true });
  } catch {}
}
