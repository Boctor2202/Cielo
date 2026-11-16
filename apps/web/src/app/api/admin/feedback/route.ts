import { handle, HttpError, requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/feedback?status=open|all&kind= — reports, newest first, with the reporter's e-mail. */
export function GET(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const u = new URL(req.url);
    let q = db.from("feedback").select("*").order("updated_at", { ascending: false }).limit(300);
    if ((u.searchParams.get("status") ?? "open") === "open") q = q.in("status", ["new", "in_progress"]);
    const kind = u.searchParams.get("kind");
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) throw error;
    const ids = [...new Set((data ?? []).map((f) => f.pilot_id).filter(Boolean))];
    const { data: who } = ids.length ? await db.from("pilots").select("id, email, full_name").in("id", ids) : { data: [] };
    const m = new Map((who ?? []).map((p) => [p.id, p]));
    return Response.json({ items: (data ?? []).map((f) => ({ ...f, reporter: f.pilot_id ? (m.get(f.pilot_id) ?? null) : null })) });
  });
}

/** PATCH /api/admin/feedback {id, status} */
export function PATCH(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const b = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
    if (!b?.id || !["new", "in_progress", "resolved", "ignored"].includes(b.status ?? "")) throw new HttpError(400, "bad_request");
    const { error } = await db.from("feedback").update({ status: b.status, updated_at: new Date().toISOString() }).eq("id", b.id);
    if (error) throw error;
    return Response.json({ ok: true });
  });
}
