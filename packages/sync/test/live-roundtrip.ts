/**
 * Live round trip against the real Supabase project, on the App Review demo account: device A writes in every
 * synced table, device B (a fresh device) must find everything; then B edits and deletes, and A must see it.
 * Run: DEMO_PASSWORD=… SUPABASE_URL=… SUPABASE_ANON_KEY=… npx tsx packages/sync/test/live-roundtrip.ts
 * (rows it creates are marked "e2e-sync" and removed at the end).
 */
import { createClient } from "@supabase/supabase-js";
import { markPilotFields, SYNC_TABLES, type TableName } from "@cielo/core";
import { createSupabaseSync } from "../src/index";
import { MemoryStore } from "./fakes";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email: "demo@geardown.app", password: process.env.DEMO_PASSWORD! });
if (authError || !auth.user) throw new Error(`sign-in: ${authError?.message}`);
const pid = auth.user.id;

const device = () => {
  const store = new MemoryStore();
  const sync = createSupabaseSync({ supabase: supabase as never, store, pilotId: pid });
  return { store, run: async () => { const r = await sync.syncNow(); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r; } };
};
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const stamp = <T extends object>(r: T) => ({ ...r, createdAt: now(), updatedAt: now(), deletedAt: null });
const results: [string, boolean, string?][] = [];
const check = (label: string, ok: boolean, detail?: string) => results.push([label, ok, detail]);

const A = device();
const B = device();
await A.run(); // A starts from the server, like a phone already signed in
const base = (await A.store.all("flights"))[0] as Record<string, unknown>;
const ac = (await A.store.all("aircraft"))[0] as Record<string, unknown>;

// --- A writes one new row in every table
const fId = id();
const rows: Partial<Record<TableName, Record<string, unknown>>> = {
  flights: stamp({ ...base, id: fId, remarks: "e2e-sync", flightNumber: "E2E001" }),
  aircraft: stamp({ ...ac, id: id(), registration: "F-E2EA", notes: "e2e-sync" }),
  licenses: stamp({ id: id(), pilotId: pid, kind: "rating", code: "e2e-sync", alertDays: [30], validUntil: "2027-01-01" }),
  opening_balances: stamp({ id: id(), pilotId: pid, asOfDate: "2020-01-01", label: "e2e-sync", totalMin: 60 }),
  rosters: stamp({ id: id(), pilotId: pid, source: "manual", fileName: "e2e-sync", importedAt: now() }),
  roster_events: stamp({ id: id(), pilotId: pid, kind: "FLIGHT", title: "e2e-sync", startUtc: "2027-01-02T08:00:00.000Z", endUtc: "2027-01-02T10:00:00.000Z" }),
  layovers: stamp({ id: id(), pilotId: pid, airportIcao: "LFMN", notes: "e2e-sync" }),
  signatures: stamp({ id: id(), pilotId: pid, flightId: fId, signerName: "e2e-sync", signerRole: "captain", signedAt: now(), imageDataUrl: "data:image/png;base64,iVBORw0KGgo=", contentHash: "e2e" }),
  flight_tracks: stamp({ id: id(), pilotId: pid, flightId: fId, hex: "abcdef", source: "adsb.lol", points: [] }),
  flight_revisions: stamp({ id: id(), pilotId: pid, flightId: fId, at: now(), action: "create", source: "server", changes: [] }),
};
for (const [t, r] of Object.entries(rows)) await A.store.bulkPut(t as TableName, [r as never]);
// and the pilot profile (only the fields marked as changed are sent)
const pilot = (await A.store.get("pilots", pid)) as Record<string, unknown>;
await A.store.bulkPut("pilots", [{ ...pilot, bio: `e2e-sync ${now()}`, updatedAt: now() } as never]);
await markPilotFields(A.store, ["bio"]);
await A.run();

// --- B, a fresh device, pulls everything
await B.run();
for (const [t, r] of Object.entries(rows)) {
  const got = (await B.store.get(t as TableName, r!.id as string)) as Record<string, unknown> | undefined;
  check(`A→B ${t}`, !!got, got ? undefined : "missing on B");
}
const bPilot = (await B.store.get("pilots", pid)) as Record<string, unknown>;
check("A→B pilots (profile)", String(bPilot?.bio ?? "").startsWith("e2e-sync"));

// --- B edits the flight and deletes the layover; A must see both
const bf = (await B.store.get("flights", fId)) as Record<string, unknown>;
await B.store.bulkPut("flights", [{ ...bf, remarks: "e2e-sync edited on B", updatedAt: now() } as never]);
const bl = (await B.store.get("layovers", rows.layovers!.id as string)) as Record<string, unknown>;
await B.store.bulkPut("layovers", [{ ...bl, deletedAt: now(), updatedAt: now() } as never]);
await B.run();
await A.run();
check("B→A edit (flight)", ((await A.store.get("flights", fId)) as Record<string, unknown>)?.remarks === "e2e-sync edited on B");
check("B→A delete (layover)", !!((await A.store.get("layovers", rows.layovers!.id as string)) as Record<string, unknown>)?.deletedAt);

for (const [label, ok, detail] of results) console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
console.log(`tables covered: ${SYNC_TABLES.filter((t) => t === "pilots" || t in rows).length}/${SYNC_TABLES.length}`);
process.exit(results.every((r) => r[1]) ? 0 : 1);
