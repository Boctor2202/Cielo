import { adminDb, userFrom } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);

/**
 * POST /api/report {kind: "bug"|"idea"|"error", message, page?, platform?, appVersion?, context?}
 * From the in-app "Report a problem" form and the automatic client error reporter. The reporter is identified
 * from the Bearer token when signed in. The same open error is counted, not duplicated.
 */
export async function POST(req: Request) {
  const db = adminDb();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = b?.kind;
  if (kind !== "bug" && kind !== "idea" && kind !== "error") return Response.json({ error: "bad_request" }, { status: 400 });
  if (rateLimited(`report:${kind}:${ip}`, kind === "error" ? 20 : 6)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const message = clip(b?.message, 4000)?.trim();
  if (!message) return Response.json({ error: "bad_request" }, { status: 400 });
  const user = await userFrom(req).catch(() => null);
  const platform = ["web", "ios", "android"].includes(String(b?.platform)) ? String(b?.platform) : "web";
  const row = {
    pilot_id: user?.id ?? null,
    kind,
    message,
    page: clip(b?.page, 300),
    platform,
    app_version: clip(b?.appVersion, 40),
    user_agent: clip(req.headers.get("user-agent"), 300),
    context: typeof b?.context === "object" && b?.context ? b.context : {},
  };
  if (kind === "error") {
    const fingerprint = `${platform}:${message.slice(0, 200)}:${(row.page ?? "").replace(/[0-9a-f-]{36}/g, ":id")}`;
    const { data: open } = await db.from("feedback").select("id, occurrences").eq("kind", "error").eq("fingerprint", fingerprint).neq("status", "resolved").maybeSingle();
    if (open) {
      await db.from("feedback").update({ occurrences: open.occurrences + 1, updated_at: new Date().toISOString(), context: row.context }).eq("id", open.id);
      return Response.json({ ok: true });
    }
    await db.from("feedback").insert({ ...row, fingerprint });
    return Response.json({ ok: true });
  }
  const { error } = await db.from("feedback").insert(row);
  if (error) return Response.json({ error: "server" }, { status: 500 });
  return Response.json({ ok: true });
}
