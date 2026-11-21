import type { Flight, Pilot, Signature } from "./types";

/** What an export or a screen shows of a flight's signature. */
export interface SignedInfo {
  signerName: string;
  signerRole: Signature["signerRole"];
  signerLicenceNumber?: string;
  signedAt: string;
  imageDataUrl: string;
  /** false when the flight was changed after it was signed (its content no longer matches the hash) */
  valid: boolean;
}

export const SIGNER_ROLE_SHORT: Record<Signature["signerRole"], string> = { captain: "CPT", instructor: "FI", examiner: "FE", other: "" };

/** "Signed J. Martin (CPT) 18/11/26", or that the flight was changed after the signature. */
export function signedLabel(s: SignedInfo): string {
  if (!s.valid) return "Signature invalid (flight changed after signing)";
  const d = s.signedAt.slice(0, 10).split("-");
  const role = SIGNER_ROLE_SHORT[s.signerRole];
  return `Signed ${s.signerName}${role ? ` (${role})` : ""} ${d[2]}/${d[1]}/${d[0]?.slice(2)}`;
}

/**
 * The pilot's own flights to sign automatically: from the day the option was turned on, unsigned, and dated
 * before today (the day after the flight, so that day's corrections come first).
 */
export function autoSignDue(flights: Flight[], pilot: Pick<Pilot, "autoSignFrom" | "signatureDataUrl">, today: string): Flight[] {
  if (!pilot.autoSignFrom || !pilot.signatureDataUrl) return [];
  return flights.filter((f) => !f.deletedAt && !f.signatureId && f.date >= pilot.autoSignFrom! && f.date < today);
}

/** The signature record of a flight signed with the pilot's saved signature (the hash is computed by the caller). */
export function ownSignature(pilot: Pick<Pilot, "id" | "fullName" | "displayName" | "licenceNumber" | "signatureDataUrl" | "signatureRole">, flight: Flight, contentHash: string, now = new Date().toISOString()) {
  return {
    pilotId: pilot.id,
    flightId: flight.id,
    signerName: (pilot.fullName || pilot.displayName || "").trim(),
    signerRole: pilot.signatureRole ?? "captain",
    signerLicenceNumber: pilot.licenceNumber || undefined,
    signedAt: now,
    imageDataUrl: pilot.signatureDataUrl ?? "",
    contentHash,
  } satisfies Omit<Signature, "id" | "createdAt" | "updatedAt" | "deletedAt">;
}
