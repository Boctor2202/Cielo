import { createHash } from "node:crypto";
import { packShare, unpackShare } from "@cielo/core";
import { adminDb } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";

/**
 * POST /api/share-link { p } → { id }: keeps a share's settings (packed as in the long link) under a short id,
 * the hash of the settings, so the same share always gets the same link.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`share:${ip}`, 30)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { p?: unknown };
  const raw = typeof body.p === "string" && body.p.length < 20_000 ? body.p : "";
  // only the settings a share may carry, re-packed
  const q = raw ? unpackShare(raw) : null;
  if (!q) return Response.json({ error: "bad_request" }, { status: 400 });
  const params = packShare(q);
  const id = createHash("sha256").update(params).digest("base64url").slice(0, 10);
  const db = adminDb();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });
  const { error } = await db.from("share_links").upsert({ id, params }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return Response.json({ error: "store" }, { status: 502 });
  return Response.json({ id });
}
