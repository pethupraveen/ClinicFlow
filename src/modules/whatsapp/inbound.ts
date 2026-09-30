import "server-only";

import type { BotInput, BotMessage } from "@/modules/bot/engine";
import { handleIncoming } from "@/modules/bot/service";
import { effectiveStatus } from "@/modules/trial/dates";
import { findSubscription } from "@/modules/trial/store";
import { findWaCode } from "./codes";
import { gateFor } from "./gate";
import { sendMessages } from "./graph";
import type { InboundMessage } from "./messages";
import { bindSharedRoute, businessByCode, gateFacts, markNoticeSent, routeFor, sharedRoute, tagInbound } from "./store";

const USE_LINK = "👋 Hi! To reach your clinic, please open its WhatsApp link or scan the QR code at the clinic.";
const UNKNOWN_CODE = "Sorry, that clinic code wasn't recognised. Please open your clinic's WhatsApp link again, or scan the QR code at the clinic.";

/**
 * Handles one patient message: find the clinic (by the receiving number, or
 * by clinic code on the shared number), apply the Go Live / trial gate, run
 * the bot, and send its replies with the right number's token.
 */
export async function processInbound(msg: InboundMessage, now: Date = new Date()): Promise<void> {
  const route = await routeFor(msg.phoneNumberId);
  if (!route) {
    console.warn("WhatsApp message for an unknown phone number id", msg.phoneNumberId);
    return;
  }
  const [phoneNumberId, token] = route.kind === "shared" ? [route.number.phoneNumberId, route.number.token] : [route.phoneNumberId, route.token];
  const reply = (messages: BotMessage[]) => sendMessages(phoneNumberId, token, msg.from, messages);

  let businessId: string;
  let input: BotInput = msg.input ?? { kind: "text", text: "" };
  if (route.kind === "shared") {
    const code = findWaCode(msg.text);
    if (code) {
      const found = await businessByCode(code);
      if (!found) return reply([{ kind: "text", text: UNKNOWN_CODE }]);
      await bindSharedRoute(msg.from, found);
      businessId = found;
      input = { kind: "text", text: "hi" }; // a code always opens that clinic's menu
    } else {
      const bound = await sharedRoute(msg.from);
      if (!bound) return reply([{ kind: "text", text: USE_LINK }]);
      businessId = bound;
    }
  } else {
    businessId = route.businessId;
  }
  await tagInbound(msg.messageId, businessId);

  const [facts, subscription] = await Promise.all([gateFacts(businessId, msg.from), findSubscription(businessId)]);
  const gate = gateFor({
    lifecycle: facts.lifecycle,
    subscription: subscription ? effectiveStatus(subscription, now) : null,
    clinicName: facts.name,
    clinicPhone: facts.phone,
    lastNoticeAt: facts.lastNoticeAt,
    now,
  });
  if (gate.kind === "silent") return;
  if (gate.kind === "notice") {
    await markNoticeSent(businessId, msg.from);
    return reply([{ kind: "text", text: gate.text }]);
  }

  const messages = await handleIncoming({
    businessId,
    channel: "WHATSAPP",
    contact: msg.from,
    message: input,
    label: msg.label,
    isTest: false,
    userId: null,
    now,
  });
  await reply(messages);
}
