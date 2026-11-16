import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase with the secret key (bypasses RLS). Used ONLY in API routes (admin back office and the
 * report endpoint); never imported by client components, never sent to a browser or the mobile app.
 */
let admin: SupabaseClient | null = null;
export function adminDb(): SupabaseClient | null {
  if (typeof window !== "undefined") throw new Error("adminDb is server-only");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

const adminIds = () => (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** The signed-in user behind the request's Bearer token (Supabase access token), or null. */
export async function userFrom(req: Request) {
  const db = adminDb();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!db || !token) return null;
  const { data } = await db.auth.getUser(token);
  return data.user ?? null;
}

export const isAdminId = (id?: string | null) => !!id && adminIds().includes(id);

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Throws 401/403 unless the request comes from an admin account. */
export async function requireAdmin(req: Request) {
  const db = adminDb();
  if (!db) throw new HttpError(503, "not_configured");
  const user = await userFrom(req);
  if (!user) throw new HttpError(401, "unauthorized");
  if (!isAdminId(user.id)) throw new HttpError(403, "forbidden");
  return { db, user };
}

export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e) => {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[admin]", e);
    return Response.json({ error: "server" }, { status: 500 });
  });
}

export const FLAG_KEYS = ["radar", "layovers", "aircraftPhotos", "flightTracks", "jobs"] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

/** Platform switches, cached 30 s per server instance. Missing table/key = enabled. */
let flagsCache: { at: number; value: Record<string, boolean> } | null = null;
export async function readFlags(): Promise<Record<FlagKey, boolean>> {
  const all = Object.fromEntries(FLAG_KEYS.map((k) => [k, true])) as Record<FlagKey, boolean>;
  if (flagsCache && Date.now() - flagsCache.at < 30_000) return { ...all, ...flagsCache.value };
  const db = adminDb();
  if (!db) return all;
  const { data } = await db.from("platform_flags").select("key, enabled");
  const value = Object.fromEntries((data ?? []).map((r: { key: string; enabled: boolean }) => [r.key, r.enabled]));
  flagsCache = { at: Date.now(), value };
  return { ...all, ...value };
}
export const resetFlagsCache = () => {
  flagsCache = null;
};
