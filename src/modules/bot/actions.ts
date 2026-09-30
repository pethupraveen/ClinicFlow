"use server";

import { refresh } from "next/cache";
import { requireMember } from "@/modules/auth/guards";
import { consumeLimit, LIMITS } from "@/modules/auth/rateLimit";
import { formFields } from "@/modules/auth/validation";
import type { BotInput } from "./engine";
import { handleIncoming } from "./service";
import { resetConversation } from "./store";

/** The owner plays a patient; their test conversation is keyed to their user id. */
async function testChatUser() {
  const { user, membership } = await requireMember("/app/onboarding/6");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") throw new Error("Only clinic owners and admins can test the bot.");
  return { userId: user.id, businessId: membership.business.id, contact: `test:${user.id}` };
}

export async function sendTestMessageAction(formData: FormData): Promise<void> {
  const f = formFields(formData, ["choice", "label", "text"]);
  const message: BotInput | null = f.choice
    ? { kind: "choice", id: f.choice.slice(0, 120) }
    : f.text.trim()
      ? { kind: "text", text: f.text.trim().slice(0, 500) }
      : null;
  if (!message) return;

  const { userId, businessId, contact } = await testChatUser();
  try {
    if (!(await consumeLimit(LIMITS.testChatPerUser, userId))) return;
    await handleIncoming({
      businessId,
      channel: "TEST_CHAT",
      contact,
      message,
      label: f.label || undefined,
      isTest: true,
      userId,
    });
  } catch (error) {
    // The transcript simply shows no reply; the owner can tap again.
    console.error("Test chat message failed", error);
  }
  refresh();
}

export async function resetTestChatAction(): Promise<void> {
  const { businessId, contact } = await testChatUser();
  await resetConversation(businessId, "TEST_CHAT", contact);
  refresh();
}
