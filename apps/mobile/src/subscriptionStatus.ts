import { useEffect, useState } from "react";
import { supabase } from "./auth";
import { useApp } from "./state";

/**
 * The end date of a cancelled card subscription (taken on geardown.app): it still runs until then.
 * Null when there is none, or it is not cancelled. The pilot reads only their own rows.
 */
/** @param tick change it to read again (e.g. after a visit to the Stripe space) */
export function useCancelledUntil(tick = 0): string | null {
  const { session } = useApp();
  const [endsAt, setEndsAt] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase || !session) return setEndsAt(null);
    void supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at:raw->>cancel_at, cape:raw->>cancel_at_period_end")
      .eq("source", "stripe")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as { status: string; current_period_end: string | null; cancel_at: string | null; cape: string | null } | null;
        if (!d || d.status === "canceled" || !(d.cancel_at || d.cape === "true")) return setEndsAt(null);
        setEndsAt(d.cancel_at ? new Date(Number(d.cancel_at) * 1000).toISOString() : d.current_period_end);
      });
  }, [session, tick]);
  return endsAt;
}
