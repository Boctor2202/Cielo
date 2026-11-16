import { handle, requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/me — 200 for an admin account, 401/403 otherwise (used to show the Admin menu). */
export function GET(req: Request) {
  return handle(async () => {
    const { user } = await requireAdmin(req);
    return Response.json({ admin: true, id: user.id });
  });
}
