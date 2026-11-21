import { useSyncExternalStore } from "react";
import { API_URL, ApiError } from "./api";

/** Signatures between Geardown pilots: the client of /api/crew (see apps/web/src/app/api/crew). */

export interface FlightSnapshot {
  date: string;
  flightNumber: string | null;
  dep: string;
  arr: string;
  out: string | null;
  in: string | null;
  registration: string | null;
  type: string | null;
  function: string | null;
  totalMin: number;
  picName: string | null;
  isFstd: boolean;
}
export interface Captain {
  name: string;
  flights: number;
  unsigned: number;
  oldest: string;
  latest: string;
  link: null | {
    id: string;
    status: "pending" | "accepted" | "refused";
    via: "email" | "licence" | "flight";
    account?: string;
    requests: { pending: number; signed: number; refused: number };
  };
  match: null | { flights: number };
}
export interface LinkRequest {
  id: string;
  status: "pending" | "accepted";
  from: string;
  crewName: string;
  via: "email" | "licence" | "flight";
  flights: number;
  shared: number;
  /** the pilot signs this colleague's requests automatically with their saved signature */
  autoApprove?: boolean;
}
export interface ToSign {
  id: string;
  from: string;
  flight: FlightSnapshot;
  hash: string;
  inMyLogbook: boolean;
}
export interface CrewData {
  me: { name: string; licence: string; savedSignature?: boolean };
  /** flights signed automatically for colleagues these last 30 days */
  autoSigned?: { from: string; flights: number }[];
  captains: Captain[];
  linkRequests: LinkRequest[];
  toSign: ToSign[];
}

async function call<T>(token: string | undefined, init?: { body: Record<string, unknown> }): Promise<T> {
  if (!token) throw new ApiError("signin", 401);
  const r = await fetch(`${API_URL}/api/crew`, {
    method: init ? "POST" : "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init ? { "Content-Type": "application/json" } : {}) },
    body: init ? JSON.stringify(init.body) : undefined,
  });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new ApiError(d.error ?? "upstream", r.status);
  return d;
}

// what waits for the pilot (link requests + flights to sign), shown as a badge in the More menu
let inbox = 0;
const listeners = new Set<() => void>();
const setInbox = (n: number) => {
  if (n === inbox) return;
  inbox = n;
  listeners.forEach((f) => f());
};
export const useCrewInbox = () =>
  useSyncExternalStore(
    (f) => (listeners.add(f), () => void listeners.delete(f)),
    () => inbox,
  );

export async function loadCrew(token?: string): Promise<CrewData> {
  const d = await call<CrewData>(token);
  setInbox(d.toSign.length + d.linkRequests.filter((l) => l.status === "pending").length);
  return d;
}
export const crewAction = <T = { ok?: boolean; status?: string; signed?: number; changed?: number; gone?: number; created?: number }>(token: string | undefined, body: Record<string, unknown>) =>
  call<T>(token, { body });


/** Creates a signing link for someone without a Geardown account (see /api/sign-link). */
export async function createSignLink(token: string | undefined, o: { flightIds: string[]; signerName: string; signerRole: string; locale: string; email?: string }): Promise<{ url: string; flights: number; mailed: boolean }> {
  if (!token) throw new ApiError("signin", 401);
  const r = await fetch(`${API_URL}/api/sign-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "create", ...o, locale: o.locale === "en" ? "en" : "fr" }),
  });
  const d = (await r.json().catch(() => ({}))) as { url?: string; flights?: number; mailed?: boolean; error?: string };
  if (!r.ok || !d.url) throw new ApiError(d.error ?? "upstream", r.status);
  return { url: d.url, flights: d.flights ?? 0, mailed: !!d.mailed };
}

