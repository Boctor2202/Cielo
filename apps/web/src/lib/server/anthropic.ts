import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client of the server. A key created at the organisation level (not inside a workspace) needs
 * the workspace it bills to: ANTHROPIC_WORKSPACE_ID (not a secret) is sent with every call when it is set.
 */
export function anthropic(): Anthropic {
  const ws = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim(), ...(ws ? { defaultHeaders: { "anthropic-workspace-id": ws } } : {}) });
}

/** The model of every AI read and draft (imports, rosters, cover letters). */
export const AI_MODEL = "claude-sonnet-5-5";

let lastAlert = 0;

/**
 * Called when a Claude call fails. When the failure comes from the account (key refused or revoked, no credit
 * left, workspace not allowed), the team gets an e-mail, at most once every 6 hours: until it is fixed, every
 * AI feature of the site is down.
 */
export async function reportAiFailure(where: string, e: unknown): Promise<void> {
  console.error(`AI call failed (${where})`, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
  if (!(e instanceof Anthropic.APIError)) return;
  const account =
    e instanceof Anthropic.AuthenticationError ||
    e instanceof Anthropic.PermissionDeniedError ||
    (e.status === 400 && /credit|billing|balance|workspace/i.test(e.message ?? ""));
  if (!account) return;
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  if (!key || !to || Date.now() - lastAlert < 6 * 3_600_000) return;
  lastAlert = Date.now();
  const reason = `${e.status} ${e.message ?? ""}`.slice(0, 500);
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Geardown <${process.env.CONTACT_FROM ?? "noreply@geardown.app"}>`,
      to: [to],
      subject: "Geardown — the AI key is refused",
      text: `Anthropic refused a call (${where}): ${reason}\n\nAll AI features (photo and PDF imports, roster PDFs, cover letters) fail until this is fixed.\nCheck the key, its workspace and the credit balance in the Anthropic console, then Admin → Platform on geardown.app.`,
    }),
  }).catch(() => null);
}
