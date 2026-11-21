import { adminDb, userFrom } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";
import { autoSign, canSign, createRequests, flightMatches, myFlights, namesOf, norm, normLicence, savedSigner, signRequests } from "@/lib/server/crew";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Signatures between Geardown pilots.
 * GET  /api/crew → the pilot's captains (names in the PIC column) and their link, flight matches with other
 *                  logbooks, link requests received, flights to sign.
 * POST /api/crew { action, … } → link | respondLink | unlink | requestOlder | sign | refuse | autoApprove
 */

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function GET(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = adminDb();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });
  const me = user.id;

  // flights logged since the last visit with a linked captain become requests
  await createRequests(db, me).catch(() => 0);

  const [{ data: self }, flights, { data: links }, { data: reqs }, { data: incoming }, { data: toSign }] = await Promise.all([
    db.from("pilots").select("full_name, display_name, licence_number, signature_data_url").eq("id", me).maybeSingle(),
    myFlights(db, me),
    db.from("crew_links").select("id, target_id, crew_name, via, status, created_at").eq("requester_id", me).order("created_at", { ascending: false }),
    db.from("signature_requests").select("flight_id, status, link_id").eq("requester_id", me),
    db.from("crew_links").select("id, requester_id, crew_name, via, status, created_at, auto_approve").eq("target_id", me).in("status", ["pending", "accepted"]),
    db.from("signature_requests").select("id, requester_id, flight, content_hash, matched_flight_id, created_at").eq("target_id", me).eq("status", "pending").order("created_at"),
  ]);
  const selfNames = new Set([norm(self?.full_name), norm(self?.display_name)].filter(Boolean));

  // the pilot's captains, by name as written
  const byName = new Map<string, { name: string; flights: number; unsigned: number; oldest: string; latest: string }>();
  for (const f of flights) {
    if (!f.pic_name || f.is_fstd) continue;
    const k = norm(f.pic_name);
    if (!k || selfNames.has(k) || k === "self") continue;
    const e = byName.get(k) ?? { name: f.pic_name.trim(), flights: 0, unsigned: 0, oldest: f.date, latest: f.date };
    e.flights++;
    if (!f.signature_id) e.unsigned++;
    if (f.date < e.oldest) e.oldest = f.date;
    if (f.date > e.latest) e.latest = f.date;
    byName.set(k, e);
  }
  const matches = await flightMatches(db, me, flights).catch(() => new Map());
  const reqByLink = new Map<string, { pending: number; signed: number; refused: number }>();
  for (const r of reqs ?? []) {
    const e = reqByLink.get(r.link_id) ?? { pending: 0, signed: 0, refused: 0 };
    if (r.status === "pending" || r.status === "signed" || r.status === "refused") e[r.status as "pending"]++;
    reqByLink.set(r.link_id, e);
  }
  const names = await namesOf(db, [...(links ?? []).filter((l) => l.status === "accepted").map((l) => l.target_id), ...(incoming ?? []).map((l) => l.requester_id), ...(toSign ?? []).map((r) => r.requester_id)]);

  const captains = [...byName.entries()]
    .map(([k, e]) => {
      const link = (links ?? []).find((l) => norm(l.crew_name) === k && l.status !== "revoked");
      const m = matches.get(k);
      return {
        ...e,
        link: link
          ? {
              id: link.id,
              status: link.status,
              via: link.via,
              // the linked account's name, once they accepted
              account: link.status === "accepted" ? names.get(link.target_id)?.name : undefined,
              requests: reqByLink.get(link.id) ?? { pending: 0, signed: 0, refused: 0 },
            }
          : null,
        match: !link || link.status === "refused" ? (m ? { flights: m.flights } : null) : null,
      };
    })
    .sort((a, b) => b.flights - a.flights);

  // how many of the requester's flights with that name are also in my logbook
  const shared = async (requesterId: string, crewName: string) => {
    const theirs = (await myFlights(db, requesterId)).filter((f) => norm(f.pic_name) === norm(crewName));
    const mineSet = new Set(flights.map((f) => `${f.date}|${f.dep_icao}|${f.arr_icao}`));
    return { flights: theirs.length, shared: theirs.filter((f) => mineSet.has(`${f.date}|${f.dep_icao}|${f.arr_icao}`)).length };
  };
  const linkRequests = await Promise.all(
    (incoming ?? []).map(async (l) => ({
      id: l.id,
      status: l.status,
      from: names.get(l.requester_id)?.name ?? "—",
      crewName: l.crew_name,
      via: l.via,
      autoApprove: !!l.auto_approve,
      createdAt: l.created_at,
      ...(l.status === "pending" ? await shared(l.requester_id, l.crew_name) : { flights: 0, shared: 0 }),
    })),
  );

  return Response.json({
    me: { name: self?.display_name || self?.full_name || "", licence: self?.licence_number ?? "", savedSignature: typeof self?.signature_data_url === "string" && self.signature_data_url.startsWith("data:image/") },
    // what was signed automatically for colleagues these last 30 days
    autoSigned: await autoSignedRecently(db, me),
    captains,
    linkRequests,
    toSign: (toSign ?? []).map((r) => ({ id: r.id, from: names.get(r.requester_id)?.name ?? "—", flight: r.flight, hash: r.content_hash, inMyLogbook: !!r.matched_flight_id })),
  });
}

export async function POST(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = adminDb();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });
  const me = user.id;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const now = new Date().toISOString();

  switch (body.action) {
    case "link": {
      if (!(await canSign(db, me))) return Response.json({ error: "plan" }, { status: 403 });
      if (rateLimited(`crew-link:${me}`, 20, 3_600_000)) return Response.json({ error: "rate_limited" }, { status: 429 });
      const name = clip(body.name, 120);
      if (!name) return Response.json({ error: "name" }, { status: 400 });
      let target: string | undefined;
      let via: "email" | "licence" | "flight";
      const email = clip(body.email, 200).toLowerCase();
      const licence = normLicence(clip(body.licence, 60));
      if (email) {
        via = "email";
        const { data } = await db.from("pilots").select("id").ilike("email", email).limit(2);
        if (data?.length === 1) target = data[0]!.id;
      } else if (licence.length >= 5) {
        via = "licence";
        // compared without spaces, dashes or dots ("FRA.FCL.PA.12345" = "FRAFCLPA12345")
        const { data } = await db.from("pilots").select("id, licence_number").not("licence_number", "is", null);
        const hits = (data ?? []).filter((p) => normLicence(p.licence_number) === licence);
        if (hits.length === 1) target = hits[0]!.id;
      } else if (body.viaFlight) {
        via = "flight";
        target = (await flightMatches(db, me)).get(norm(name))?.targetId;
      } else return Response.json({ error: "identifier" }, { status: 400 });
      if (!target || target === me) return Response.json({ status: "not_found" });
      // a refused or revoked link can be asked again
      const { error } = await db.from("crew_links").insert({ requester_id: me, target_id: target, crew_name: name, via });
      if (error && !/duplicate|unique/i.test(error.message)) return Response.json({ error: "db" }, { status: 500 });
      return Response.json({ status: "pending" });
    }

    case "respondLink": {
      const id = clip(body.id, 40);
      const accept = body.accept === true;
      const { data: l } = await db.from("crew_links").select("id, requester_id").eq("id", id).eq("target_id", me).eq("status", "pending").maybeSingle();
      if (!l) return Response.json({ error: "not_found" }, { status: 404 });
      if (accept && !(await canSign(db, me))) return Response.json({ error: "plan" }, { status: 403 });
      await db.from("crew_links").update({ status: accept ? "accepted" : "refused", responded_at: now, updated_at: now }).eq("id", id);
      if (accept) await createRequests(db, l.requester_id, { linkId: id });
      return Response.json({ ok: true });
    }

    case "unlink": {
      const id = clip(body.id, 40);
      const { data: l } = await db.from("crew_links").select("id, requester_id, target_id").eq("id", id).maybeSingle();
      if (!l || (l.requester_id !== me && l.target_id !== me)) return Response.json({ error: "not_found" }, { status: 404 });
      await db.from("crew_links").update({ status: "revoked", updated_at: now }).eq("id", id);
      await db.from("signature_requests").update({ status: "cancelled", updated_at: now }).eq("link_id", id).eq("status", "pending");
      return Response.json({ ok: true });
    }

    case "requestOlder": {
      // every unsigned flight with that captain, however old
      const id = clip(body.linkId, 40);
      const { data: l } = await db.from("crew_links").select("id").eq("id", id).eq("requester_id", me).eq("status", "accepted").maybeSingle();
      if (!l) return Response.json({ error: "not_found" }, { status: 404 });
      return Response.json({ created: await createRequests(db, me, { linkId: id, since: "0000-01-01" }) });
    }

    case "sign": {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 500) as { id?: string; hash?: string }[];
      // the signature drawn now, or the one the pilot saved
      const drawn = typeof body.image === "string" && body.image.startsWith("data:image/") && body.image.length < 400_000 ? body.image : "";
      const signer = body.useSaved ? await savedSigner(db, me) : drawn && clip(body.signerName, 120) ? { image: drawn, name: clip(body.signerName, 120), licence: clip(body.licence, 60) || null } : null;
      if (!items.length || !signer) return Response.json({ error: body.useSaved ? "no_saved_signature" : "input" }, { status: 400 });
      const { data: reqs } = await db.from("signature_requests").select("*").eq("target_id", me).eq("status", "pending").in("id", items.map((i) => String(i.id)));
      const seen = new Map(items.map((i) => [String(i.id), String(i.hash ?? "")]));
      return Response.json(await signRequests(db, reqs ?? [], signer, { seen }));
    }

    case "autoApprove": {
      // the signer approves (or stops approving) one colleague's requests with their saved signature
      const id = clip(body.linkId, 40);
      const on = body.on === true;
      if (on && !(await savedSigner(db, me))) return Response.json({ error: "no_saved_signature" }, { status: 400 });
      const { data: l } = await db.from("crew_links").update({ auto_approve: on, updated_at: now }).eq("id", id).eq("target_id", me).eq("status", "accepted").select("id, requester_id").maybeSingle();
      if (!l) return Response.json({ error: "not_found" }, { status: 404 });
      // what that colleague already asked is signed now
      let signed = 0;
      if (on) {
        const { data: pending } = await db.from("signature_requests").select("*").eq("link_id", id).eq("target_id", me).eq("status", "pending");
        if (pending?.length) signed = await autoSign(db, me, l.requester_id, pending);
      }
      return Response.json({ ok: true, signed });
    }

    case "refuse": {
      const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 500).map(String);
      if (!ids.length) return Response.json({ error: "input" }, { status: 400 });
      await db
        .from("signature_requests")
        .update({ status: "refused", refusal: clip(body.reason, 300) || null, responded_at: now, updated_at: now })
        .eq("target_id", me)
        .eq("status", "pending")
        .in("id", ids);
      return Response.json({ ok: true });
    }
  }
  return Response.json({ error: "action" }, { status: 400 });
}

/** Flights signed automatically for colleagues in the last 30 days, by colleague. */
async function autoSignedRecently(db: NonNullable<ReturnType<typeof adminDb>>, me: string) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await db.from("signature_requests").select("requester_id").eq("target_id", me).eq("status", "signed").eq("auto", true).gte("responded_at", since);
  const count = new Map<string, number>();
  for (const r of data ?? []) count.set(r.requester_id, (count.get(r.requester_id) ?? 0) + 1);
  const names = await namesOf(db, [...count.keys()]);
  return [...count.entries()].map(([id, n]) => ({ from: names.get(id)?.name ?? "—", flights: n }));
}
