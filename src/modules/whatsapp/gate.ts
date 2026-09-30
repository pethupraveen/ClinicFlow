import type { SubscriptionStatus } from "@/modules/trial/dates";

export type Lifecycle = "ONBOARDING" | "LIVE" | "PAUSED" | "PENDING_DELETION";

export const NOTICE_INTERVAL_HOURS = 24;

export type Gate = { kind: "bot" } | { kind: "notice"; text: string } | { kind: "silent" };

/**
 * Decides whether a real WhatsApp patient reaches the bot. Clinics that are
 * not live, or whose trial has expired, send a polite notice at most once per
 * 24 h per patient; the in-app test chat never passes through here.
 */
export function gateFor(input: {
  lifecycle: Lifecycle;
  subscription: SubscriptionStatus | null;
  clinicName: string;
  clinicPhone: string;
  lastNoticeAt: Date | null;
  now: Date;
}): Gate {
  const call = input.clinicPhone ? ` Please call us on ${input.clinicPhone}.` : "";
  let text: string | null = null;
  if (input.subscription === "EXPIRED" || input.subscription === "CANCELLED") {
    text = `${input.clinicName}: online booking on WhatsApp is currently unavailable.${call}`;
  } else if (input.lifecycle !== "LIVE") {
    text = `${input.clinicName} isn't taking WhatsApp bookings yet.${call}`;
  }
  if (!text) return { kind: "bot" };
  const recent = input.lastNoticeAt && input.now.getTime() - input.lastNoticeAt.getTime() < NOTICE_INTERVAL_HOURS * 3_600_000;
  return recent ? { kind: "silent" } : { kind: "notice", text };
}
