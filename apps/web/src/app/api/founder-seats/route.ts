import { founderSeatsShown } from "@cielo/core";
import { adminDb } from "@/lib/server/admin";

/**
 * GET /api/founder-seats: the founder-price seats left, from the real number of pilots who ever subscribed
 * (Stripe, App Store), or null while fewer than half are taken (then the site just says « the first subscribers »).
 */
export const revalidate = 3600;

export async function GET() {
  const db = adminDb();
  if (!db) return Response.json({ left: null });
  const { data, error } = await db.from("subscriptions").select("pilot_id");
  if (error || !data) return Response.json({ left: null });
  const subscribers = new Set(data.map((r) => r.pilot_id as string)).size;
  return Response.json({ left: founderSeatsShown(subscribers) });
}
