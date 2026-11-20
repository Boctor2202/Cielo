/**
 * Product metrics without collecting people: an event name and the platform, counted per day on the server.
 * Never a user id, an e-mail, a flight, a document or medical data. Off unless enabled, and never sent when the
 * browser asks not to be tracked (Global Privacy Control / Do Not Track).
 */
export const FUNNEL_EVENTS = [
  "demo_open", // "See the demo" opened
  "signup", // account created
  "import_start",
  "import_success",
  "import_fail",
  "first_flight", // first flight saved on this device
  "export", // a logbook export produced
  "checkout_open", // subscription checkout opened
  "support_request",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];
export const isFunnelEvent = (e: unknown): e is FunnelEvent => typeof e === "string" && (FUNNEL_EVENTS as readonly string[]).includes(e);
