import { handle, HttpError, requireAdmin } from "@/lib/server/admin";
import { adsbFlights, HEX_SOURCES } from "@/lib/adsbTimes";
import { flightAwareProbe } from "@/lib/flightaware";
import { openaipProbe } from "@/lib/server/openaip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/admin/adsb-check?reg=9H-AST — which open source knows this registration's Mode S address. */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const reg = (new URL(req.url).searchParams.get("reg") ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,10}$/.test(reg)) throw new HttpError(400, "bad_request");
    const sources = await Promise.all(
      HEX_SOURCES.map(async (s) => {
        const t0 = Date.now();
        try {
          const hex = await s.find(reg);
          return { source: s.key, hex: hex ?? null, ms: Date.now() - t0 };
        } catch (e) {
          return { source: s.key, hex: null, error: e instanceof Error ? e.message.slice(0, 120) : "error", ms: Date.now() - t0 };
        }
      }),
    );
    // with an address: the flights its ADS-B trace holds (today and yesterday)
    const hex = sources.find((s) => s.hex)?.hex ?? undefined;
    const today = new Date().toISOString().slice(0, 10);
    const adsb = hex ? await adsbFlights(reg, today, hex, true).catch((e: Error) => e.message) : null;
    const fa = new URL(req.url).searchParams.get("fa") === "1" ? await flightAwareProbe(reg).catch((e: Error) => e.message) : null;
    const openaip = await openaipProbe();
    return Response.json({ reg, sources, adsb, fa, openaip });
  });
}
