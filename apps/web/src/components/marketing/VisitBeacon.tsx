"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Set on a browser where the admin opened the admin page: its visits are not counted. */
export const NO_COUNT_KEY = "gd-no-visit-count";

/** Counts the visitor of the website once per day and page view (no cookie: see /api/visit). */
export function VisitBeacon() {
  const path = usePathname();
  useEffect(() => {
    try {
      if (localStorage.getItem(NO_COUNT_KEY)) return;
    } catch {}
    const n = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
    if (n.globalPrivacyControl || n.doNotTrack === "1" || n.webdriver) return;
    try {
      void fetch("/api/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, ref: document.referrer }), keepalive: true });
    } catch {}
  }, [path]);
  return null;
}
