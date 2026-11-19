"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCloud } from "@/lib/cloud";

export interface SubscriptionStatus {
  /** cancelled: the access runs until `endsAt`, then stops (unless the pilot renews it) */
  cancelled: boolean;
  endsAt?: string;
  trial: boolean;
}

/** The pilot's latest card subscription, read from the server (own rows only): is it cancelled, and until when. */
export function useSubscriptionStatus(): SubscriptionStatus | null {
  const cloud = useCloud();
  const [s, setS] = useState<SubscriptionStatus | null>(null);
  useEffect(() => {
    const sb = supabase();
    if (!sb || !cloud.session) return;
    void sb
      .from("subscriptions")
      .select("status, current_period_end, cancel_at:raw->>cancel_at, cape:raw->>cancel_at_period_end")
      .eq("source", "stripe")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || data.status === "canceled") return setS(null);
        const d = data as { status: string; current_period_end: string | null; cancel_at: string | null; cape: string | null };
        const at = d.cancel_at ? new Date(Number(d.cancel_at) * 1000).toISOString() : d.current_period_end ?? undefined;
        setS({ cancelled: !!d.cancel_at || d.cape === "true", endsAt: at, trial: d.status === "trialing" });
      });
  }, [cloud.session]);
  return s;
}
