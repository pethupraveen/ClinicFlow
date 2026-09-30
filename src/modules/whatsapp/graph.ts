import "server-only";

import type { BotMessage } from "@/modules/bot/engine";
import { ENV, readEnv } from "@/lib/env";
import { toGraphMessage } from "./messages";

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${readEnv(ENV.graphVersion) ?? "v23.0"}/${path}`;
}

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function graph(path: string, token: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(graphUrl(path), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail = (body.error as { message?: string } | undefined)?.message ?? `HTTP ${response.status}`;
    throw new GraphError(detail, response.status);
  }
  return body;
}

/** Confirms a phone number ID + token pair works, and returns what Meta knows about the number. */
export async function lookupPhoneNumber(phoneNumberId: string, token: string): Promise<{ displayPhone: string; verifiedName: string }> {
  const body = await graph(`${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, token);
  return { displayPhone: String(body.display_phone_number ?? ""), verifiedName: String(body.verified_name ?? "") };
}

/** Sends the bot's replies in order; stops at the first failure. */
export async function sendMessages(phoneNumberId: string, token: string, to: string, messages: BotMessage[]): Promise<void> {
  for (const message of messages) {
    await graph(`${encodeURIComponent(phoneNumberId)}/messages`, token, {
      method: "POST",
      body: JSON.stringify(toGraphMessage(to, message)),
    });
  }
}
