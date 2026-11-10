// Supabase clients for edge functions. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically by the Supabase runtime.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { requireEnv } from "./http.ts";

/** Service-role client: bypasses RLS. Use only for server-side writes. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client acting as the caller (RLS applies), built from the request's Authorization header. */
export function userClient(req: Request): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

/** Resolves the authenticated user of the request, or null. */
export async function getUser(req: Request): Promise<{ user: User; client: SupabaseClient } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const client = userClient(req);
  const { data, error } = await client.auth.getUser(auth.slice("Bearer ".length));
  if (error || !data.user) return null;
  return { user: data.user, client };
}

/** Lists every object path under `prefix` in a bucket (Storage list() is not recursive). */
export async function listAllObjects(client: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`storage list ${prefix}: ${error.message}`);
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Folders are returned as entries without an id.
      if (!item.id) out.push(...(await listAllObjects(client, bucket, path)));
      else out.push(path);
    }
    if (!data || data.length < pageSize) break;
  }
  return out;
}
