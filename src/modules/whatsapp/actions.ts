"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/modules/auth/guards";
import { fieldErrors, formFields, type FieldErrors } from "@/modules/auth/validation";
import { computeProgress } from "@/modules/onboarding/steps";
import { getOnboardingFacts } from "@/modules/onboarding/store";
import { requireStaff } from "@/modules/platform/staff";
import { GraphError, lookupPhoneNumber } from "./graph";
import {
  businessIdByPublicId,
  closeRequest,
  connectOwnNumber,
  disconnectOwnNumber,
  requestSetup,
  setLifecycle,
} from "./store";

export interface WaFormState {
  fieldErrors?: FieldErrors;
  formError?: string;
  message?: string;
  values?: Record<string, string>;
}

async function owner() {
  const { user, membership } = await requireMember("/app/onboarding/5");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") throw new Error("Only clinic owners and admins can change this.");
  return { userId: user.id, businessId: membership.business.id, emailVerified: membership.emailVerified };
}

// ---------- clinic: step 5 ----------

const requestSchema = z.object({
  contactPhone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,18}$/, "Enter a phone number we can call, e.g. +91 98765 43210."),
  preferredTime: z.string().trim().max(80, "Keep this short."),
  note: z.string().trim().max(500, "Keep the note under 500 characters."),
});

export async function requestOwnNumberAction(_prev: WaFormState, formData: FormData): Promise<WaFormState> {
  const raw = formFields(formData, ["contactPhone", "preferredTime", "note"]);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };
  try {
    const { userId, businessId } = await owner();
    await requestSetup({ businessId, userId, ...parsed.data });
  } catch (error) {
    unstable_rethrow(error);
    console.error("WhatsApp setup request failed", error);
    return { formError: "We couldn't send your request. Please try again.", values: raw };
  }
  refresh();
  return { message: "Thanks! The ClinicFlow team will call you to set up your own number." };
}

// ---------- clinic: step 7 ----------

export async function goLiveAction(): Promise<void> {
  const { userId, businessId, emailVerified } = await owner();
  // Re-check the mandatory items on the server; the button is only a convenience.
  const progress = computeProgress(await getOnboardingFacts(businessId, emailVerified));
  if (progress.mandatoryDone < progress.mandatoryTotal) return;
  await setLifecycle(businessId, userId, "LIVE");
  refresh();
}

export async function pauseAction(): Promise<void> {
  const { userId, businessId } = await owner();
  await setLifecycle(businessId, userId, "PAUSED");
  refresh();
}

// ---------- staff: /platform/whatsapp ----------

const connectSchema = z.object({
  clinic: z.string().regex(/^c_[0-9a-z]{12}$/),
  phoneNumberId: z.string().trim().regex(/^[0-9]{5,30}$/, "The phone number ID is a long number from WhatsApp → API Setup."),
  token: z.string().trim().min(20, "Paste the full access token.").max(1000),
});

export async function connectNumberAction(_prev: WaFormState, formData: FormData): Promise<WaFormState> {
  const staff = await requireStaff();
  const raw = formFields(formData, ["clinic", "phoneNumberId", "token"]);
  const parsed = connectSchema.safeParse(raw);
  const values = { phoneNumberId: raw.phoneNumberId };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  try {
    const businessId = await businessIdByPublicId(parsed.data.clinic);
    if (!businessId) return { formError: "Clinic not found.", values };
    // Prove the pair works before storing anything.
    const number = await lookupPhoneNumber(parsed.data.phoneNumberId, parsed.data.token);
    await connectOwnNumber({
      businessId,
      staffUserId: staff.id,
      phoneNumberId: parsed.data.phoneNumberId,
      token: parsed.data.token,
      displayPhone: number.displayPhone,
      verifiedName: number.verifiedName,
    });
    refresh();
    return { message: `Connected ${number.displayPhone}${number.verifiedName ? ` (${number.verifiedName})` : ""}.` };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof GraphError) return { formError: `Meta rejected these details: ${error.message}`, values };
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return { formError: "That phone number ID is already connected to another clinic.", values };
    }
    console.error("Connecting WhatsApp number failed", error);
    return { formError: "Connecting failed. Check the server logs.", values };
  }
}

export async function disconnectNumberAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const businessId = await businessIdByPublicId(formFields(formData, ["clinic"]).clinic);
  if (businessId) await disconnectOwnNumber(businessId, staff.id);
  refresh();
}

export async function closeRequestAction(formData: FormData): Promise<void> {
  await requireStaff();
  const businessId = await businessIdByPublicId(formFields(formData, ["clinic"]).clinic);
  if (businessId) await closeRequest(businessId);
  refresh();
}
