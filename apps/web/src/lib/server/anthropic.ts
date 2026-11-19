import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client of the server. A key created at the organisation level (not inside a workspace) needs
 * the workspace it bills to: ANTHROPIC_WORKSPACE_ID (not a secret) is sent with every call when it is set.
 */
export function anthropic(): Anthropic {
  const ws = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim(), ...(ws ? { defaultHeaders: { "anthropic-workspace-id": ws } } : {}) });
}
