"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isCloudEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/site";

let client: SupabaseClient | null = null;

/** null when the cloud backend isn't configured (local mode). */
export function supabase(): SupabaseClient | null {
  if (!isCloudEnabled()) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
