"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  decodeTouch,
  FIRST_TOUCH_COOKIE,
  isValidVisitorId,
  LAST_TOUCH_COOKIE,
  VISITOR_COOKIE,
} from "@/modules/attribution/attribution";
import { createAccountRecords, findMembership } from "./accounts";
import { getSessionUser } from "./guards";
import { clientIpHash, consumeLimit, LIMITS } from "./rateLimit";
import { APP_HOME } from "./redirects";
import { authClient } from "./supabase";
import { fieldErrors, formFields, welcomeSchema, type FieldErrors } from "./validation";

export interface FormState {
  fieldErrors?: FieldErrors;
  formError?: string;
  /** Echoed back so the form keeps what was typed. */
  values?: Record<string, string>;
}

/** First-time setup after Google sign-in: creates the clinic and OWNER membership. */
export async function createClinicAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formFields(formData, ["fullName", "clinicName"]);
  const parsed = welcomeSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };

  try {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    if (await findMembership(user.id)) redirect(APP_HOME);

    const ipHash = await clientIpHash();
    if (!(await consumeLimit(LIMITS.createClinicPerIp, ipHash))) {
      return { formError: "Too many attempts. Please wait a while and try again.", values: raw };
    }

    const cookieStore = await cookies();
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
    await createAccountRecords({
      userId: user.id,
      fullName: parsed.data.fullName,
      clinicName: parsed.data.clinicName,
      emailVerified: user.emailVerified,
      visitorId: isValidVisitorId(visitorId) ? visitorId : null,
      firstTouch: decodeTouch(cookieStore.get(FIRST_TOUCH_COOKIE)?.value),
      lastTouch: decodeTouch(cookieStore.get(LAST_TOUCH_COOKIE)?.value),
      ipHash,
    });
  } catch (error) {
    // redirect() works by throwing; let it through.
    unstable_rethrow(error);
    console.error("Creating clinic failed", error);
    return { formError: "We couldn't set up your clinic. Please try again in a moment.", values: raw };
  }
  redirect(APP_HOME);
}

export async function logoutAction(): Promise<void> {
  try {
    const supabase = await authClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    console.error("Logout failed", error);
  }
  redirect("/");
}
