import "server-only";

import { step, type BotInput, type BotMessage } from "./engine";
import {
  bookAppointment,
  cancelFor,
  doctorOpenSlots,
  getConversation,
  loadBotContext,
  markNeedsHuman,
  saveTurn,
  upcomingFor,
  type Channel,
} from "./store";

/**
 * Runs one incoming patient message through the bot for a clinic and
 * persists the conversation. Shared by the in-app test chat and (6c) WhatsApp.
 */
export async function handleIncoming(input: {
  businessId: string;
  channel: Channel;
  contact: string;
  message: BotInput;
  /** What the patient saw on the button they tapped, for the transcript. */
  label?: string;
  isTest: boolean;
  userId: string | null;
  now?: Date;
}): Promise<BotMessage[]> {
  const now = input.now ?? new Date();
  const { businessId, contact } = input;
  const conversation = await getConversation(businessId, input.channel, contact);
  const ctx = await loadBotContext(businessId, contact, now);

  const result = await step(conversation.state, input.message, ctx, {
    openSlots: (doctorId) => doctorOpenSlots(businessId, doctorId, now, ctx.timeZone),
    book: ({ doctorId, start, name }) =>
      bookAppointment({
        businessId,
        doctorPublicId: doctorId,
        start,
        patientPhone: contact,
        patientName: name,
        channel: input.channel,
        isTest: input.isTest,
        userId: input.userId,
      }),
    upcoming: () => upcomingFor(businessId, contact, now),
    cancel: (ref) => cancelFor(businessId, contact, ref, now, input.userId),
    requestHuman: () => markNeedsHuman(conversation.id, businessId),
  });

  await saveTurn({
    conversationId: conversation.id,
    businessId,
    state: result.state,
    incoming: { ...input.message, ...(input.label ? { label: input.label.slice(0, 60) } : {}) },
    outgoing: result.messages,
  });
  return result.messages;
}
