// GDPR art. 15/20: returns every row the signed-in pilot owns, plus signed URLs
// (valid 1 hour) for their attachments. Uses the caller's JWT, so RLS guarantees
// only their own data is returned.
import { errorResponse, json, preflight } from "../_shared/http.ts";
import { getUser, listAllObjects } from "../_shared/supabase.ts";

const BUCKET = "attachments";
const SIGNED_URL_TTL_SEC = 3600;

/** Table -> owner column. */
const TABLES: Record<string, string> = {
  pilots: "id",
  aircraft_types: "owner_pilot_id",
  aircraft: "pilot_id",
  flights: "pilot_id",
  opening_balances: "pilot_id",
  signatures: "pilot_id",
  licenses: "pilot_id",
  rosters: "pilot_id",
  roster_events: "pilot_id",
  layovers: "pilot_id",
  subscriptions: "pilot_id",
  push_tokens: "pilot_id",
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST" && req.method !== "GET") return errorResponse(405, "method not allowed");

  const auth = await getUser(req);
  if (!auth) return errorResponse(401, "unauthorized");
  const { user, client } = auth;

  const data: Record<string, unknown[]> = {};
  for (const [table, ownerColumn] of Object.entries(TABLES)) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await client
        .from(table)
        .select("*")
        .eq(ownerColumn, user.id)
        .order("id")
        .range(from, from + 999);
      if (error) return errorResponse(500, `${table}: ${error.message}`);
      rows.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }
    data[table] = rows;
  }

  let attachments: { path: string; signedUrl: string | null }[] = [];
  try {
    const paths = await listAllObjects(client, BUCKET, user.id);
    for (let i = 0; i < paths.length; i += 100) {
      const { data: signed, error } = await client.storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 100), SIGNED_URL_TTL_SEC);
      if (error) throw error;
      attachments = attachments.concat((signed ?? []).map((s) => ({ path: s.path ?? "", signedUrl: s.signedUrl ?? null })));
    }
  } catch (e) {
    return errorResponse(500, `attachments: ${(e as Error).message}`);
  }

  const exportedAt = new Date().toISOString();
  return json(
    {
      format: "cielo-export",
      version: 1,
      exportedAt,
      user: { id: user.id, email: user.email, createdAt: user.created_at },
      data,
      attachments,
      attachmentsUrlExpiresInSeconds: SIGNED_URL_TTL_SEC,
    },
    200,
    { "Content-Disposition": `attachment; filename="cielo-export-${exportedAt.slice(0, 10)}.json"` },
  );
});
