import { useEffect, useRef } from "react";
import * as Crypto from "expo-crypto";
import { autoSignDue, canonicalFlightContent, newId, ownSignature, type Flight, type Pilot, type SignedInfo, type Signature } from "@cielo/core";
import { todayUtc, useApp, type AppState } from "./state";

export const flightHash = (f: Flight) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalFlightContent(f));

/**
 * Signs the pilot's own flights with their saved signature: a signature per flight (with the hash of its
 * content) and the flight locked, all written at once. Flights already signed are left as they are.
 */
export async function signWithSaved(app: Pick<AppState, "putMany" | "pilot">, flights: Flight[]): Promise<number> {
  const pilot = app.pilot;
  if (!pilot.signatureDataUrl) return 0;
  const todo = flights.filter((f) => !f.deletedAt && !f.signatureId);
  if (!todo.length) return 0;
  const now = new Date().toISOString();
  const sigs: Partial<Signature>[] = [];
  const locked: Partial<Flight>[] = [];
  for (const f of todo) {
    const id = newId();
    sigs.push({ id, ...ownSignature(pilot, f, await flightHash(f), now) });
    locked.push({ ...f, signatureId: id, locked: true });
  }
  await app.putMany("signatures", sigs);
  await app.putMany("flights", locked);
  return todo.length;
}

/** The flights' signatures for an export: who signed, and whether each flight is unchanged since. */
export async function signaturesFor(store: AppState["store"], flights: Flight[]): Promise<Record<string, SignedInfo>> {
  const out: Record<string, SignedInfo> = {};
  for (const f of flights) {
    if (!f.signatureId || f.deletedAt) continue;
    const s = await store.get("signatures", f.signatureId);
    if (!s || s.deletedAt) continue;
    out[f.id] = { signerName: s.signerName, signerRole: s.signerRole, signerLicenceNumber: s.signerLicenceNumber, signedAt: s.signedAt, imageDataUrl: s.imageDataUrl, valid: (await flightHash(f)) === s.contentHash };
  }
  return out;
}

/** Automatic signature of the pilot's own flights (when they turned it on): the day after each flight. */
export function useAutoSign(): void {
  const app = useApp();
  const busy = useRef(false);
  const { flights, pilot, access } = app;
  useEffect(() => {
    if (busy.current || !access.canWrite || !access.has("signature")) return;
    const due = autoSignDue(flights, pilot as Pilot, todayUtc());
    if (!due.length) return;
    busy.current = true;
    void signWithSaved(app, due)
      .catch(() => 0)
      .finally(() => (busy.current = false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights, pilot.autoSignFrom, pilot.signatureDataUrl, access.canWrite]);
}
