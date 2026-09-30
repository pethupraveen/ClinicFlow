import { type NextRequest } from "next/server";
import { ENV, readEnv } from "@/lib/env";
import { processInbound } from "@/modules/whatsapp/inbound";
import { parseWebhook } from "@/modules/whatsapp/messages";
import { validSignature } from "@/modules/whatsapp/secrets";
import { claimInbound, releaseInbound } from "@/modules/whatsapp/store";

export const runtime = "nodejs";

/** Meta's one-time verification handshake when the webhook is registered. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const expected = readEnv(ENV.whatsappVerifyToken);
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new Response(params.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Incoming WhatsApp messages. The raw body must carry Meta's HMAC signature.
 * Each message id is claimed once; if handling fails the claim is released
 * and we answer 500 so Meta retries.
 */
export async function POST(request: NextRequest) {
  const secret = readEnv(ENV.metaAppSecret);
  if (!secret) return new Response("Not configured", { status: 503 });

  const raw = await request.text();
  if (raw.length > 1_000_000 || !validSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  let failed = false;
  for (const message of parseWebhook(payload)) {
    if (!(await claimInbound(message.messageId))) continue; // already handled (Meta retry)
    try {
      await processInbound(message);
    } catch (error) {
      console.error("WhatsApp message handling failed", message.messageId, error);
      await releaseInbound(message.messageId).catch(() => {});
      failed = true;
    }
  }
  return new Response(failed ? "Retry" : "OK", { status: failed ? 500 : 200 });
}
