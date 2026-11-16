import { readFlags } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** GET /api/flags — public platform switches (which features are on). */
export async function GET() {
  return Response.json(await readFlags(), { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
}
