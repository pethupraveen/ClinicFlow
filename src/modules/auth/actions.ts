"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/site";
import {
  decodeTouch,
  FIRST_TOUCH_COOKIE,
  isValidVisitorId,
  LAST_TOUCH_COOKIE,
  VISITOR_COOKIE,
} from "@/modules/attribution/attribution";
import { consumeVerificationToken, createAccountRecords, createVerificationToken, findMembership, recordAudit } from "./accounts";
import { isBreachedPassword } from "./breachedPasswords";
import { sendEmail, verificationEmail } from "./email";
import { getSessionUser } from "./guards";
import { clientIpHash, consumeLimit, LIMITS } from "./rateLimit";
import { APP_HOME, safeNextPath } from "./redirects";
import { registerAccount } from "./signup";
import { adminClient, authClient } from "./supabase";
import {
  fieldErrors,
  formFields,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type FieldErrors,
} from "./validation";

export interface FormState {
  fieldErrors?: FieldErrors;
  formError?: string;
  message?: string;
  /** Echoed back so the form keeps what was typed. Never includes passwords. */
  values?: Record<string, string>;
}

const TOO_MANY = "Too many attempts. Please wait a while and try again.";
const BREACHED =
  "This password has appeared in a known data breach. Please choose a different one.";
const UNAVAILABLE = "Sign-in is temporarily unavailable. Please try again in a few minutes.";

function verifyLink(token: string): string {
  return `${SITE_URL}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formFields(formData, ["fullName", "clinicName", "email", "password"]);
  const values = { fullName: raw.fullName, clinicName: raw.clinicName, email: raw.email };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const input = parsed.data;

  try {
    const ipHash = await clientIpHash();
    if (!(await consumeLimit(LIMITS.signupPerIp, ipHash))) return { formError: TOO_MANY, values };
    if (await isBreachedPassword(input.password)) return { fieldErrors: { password: BREACHED }, values };

    const cookieStore = await cookies();
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
    const supabase = await authClient();

    const outcome = await registerAccount(input, {
      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) {
          if (error.code === "user_already_exists" || error.code === "email_exists") return { ok: false, reason: "exists" };
          if (error.code === "weak_password") return { ok: false, reason: "rejected", message: error.message };
          console.error("Supabase signUp failed", error.code, error.message);
          return { ok: false, reason: "failed" };
        }
        if (!data.user || !data.session) {
          // Confirm email is still on in Supabase, or the email is already taken.
          console.error("Supabase signUp returned no session; check that Confirm email is off");
          return { ok: false, reason: "exists" };
        }
        return { ok: true, userId: data.user.id };
      },
      createRecords: (userId) =>
        createAccountRecords({
          userId,
          fullName: input.fullName,
          clinicName: input.clinicName,
          visitorId: isValidVisitorId(visitorId) ? visitorId : null,
          firstTouch: decodeTouch(cookieStore.get(FIRST_TOUCH_COOKIE)?.value),
          lastTouch: decodeTouch(cookieStore.get(LAST_TOUCH_COOKIE)?.value),
          ipHash,
        }),
      async deleteAuthUser(userId) {
        const { error } = await adminClient().auth.admin.deleteUser(userId);
        if (error) throw error;
      },
      async signOutLocal() {
        await supabase.auth.signOut({ scope: "local" });
      },
      sendVerification: (token) =>
        sendEmail(verificationEmail({ to: input.email, name: input.fullName, link: verifyLink(token) })),
      logError: (message, error) => console.error(message, error),
    });

    if (!outcome.ok) return { formError: outcome.formError, values };
  } catch (error) {
    console.error("Signup failed", error);
    return { formError: UNAVAILABLE, values };
  }
  redirect(APP_HOME);
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formFields(formData, ["email", "password", "next"]);
  const values = { email: raw.email };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  try {
    const ipHash = await clientIpHash();
    const withinLimits =
      (await consumeLimit(LIMITS.loginPerIp, ipHash)) && (await consumeLimit(LIMITS.loginPerEmail, parsed.data.email));
    if (!withinLimits) return { formError: TOO_MANY, values };

    const supabase = await authClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      if (error.status && error.status >= 500) console.error("Supabase sign-in failed", error.code, error.message);
      return { formError: "Invalid email or password.", values };
    }
  } catch (error) {
    console.error("Login failed", error);
    return { formError: UNAVAILABLE, values };
  }
  redirect(safeNextPath(raw.next));
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

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formFields(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };

  // Identical response whether or not the account exists.
  const sent: FormState = {
    message: "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour.",
  };
  try {
    const ipHash = await clientIpHash();
    const withinLimits =
      (await consumeLimit(LIMITS.forgotPerIp, ipHash)) && (await consumeLimit(LIMITS.forgotPerEmail, parsed.data.email));
    if (!withinLimits) return sent;

    const supabase = await authClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password`,
    });
    if (error && !(error.status && error.status < 500)) console.error("Password reset email failed", error.code, error.message);
  } catch (error) {
    console.error("Forgot password failed", error);
  }
  return sent;
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(formFields(formData, ["password", "confirmPassword"]));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  try {
    const user = await getSessionUser();
    if (!user) return { formError: "Your reset link has expired. Request a new one." };
    if (await isBreachedPassword(parsed.data.password)) return { fieldErrors: { password: BREACHED } };

    const supabase = await authClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      if (error.code === "same_password") return { fieldErrors: { password: "Choose a password you haven't used here before." } };
      if (error.code === "weak_password") return { fieldErrors: { password: error.message } };
      console.error("Password update failed", error.code, error.message);
      return { formError: UNAVAILABLE };
    }
    // A reset must end every other session, e.g. on a stolen device.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
    if (signOutError) console.error("Revoking other sessions failed", signOutError.code, signOutError.message);
    await recordAudit({ userId: user.id, action: "auth.password_reset", ipHash: await clientIpHash() });
  } catch (error) {
    console.error("Reset password failed", error);
    return { formError: UNAVAILABLE };
  }
  redirect(`${APP_HOME}?reset=1`);
}

export async function confirmEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = formFields(formData, ["token"]).token;
  const invalid: FormState = { formError: "This link is invalid or has expired. Log in to request a new one." };
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return invalid;
  try {
    const ipHash = await clientIpHash();
    if (!(await consumeLimit(LIMITS.confirmPerIp, ipHash))) return { formError: TOO_MANY };
    if (!(await consumeVerificationToken(token, ipHash))) return invalid;
  } catch (error) {
    console.error("Email confirmation failed", error);
    return { formError: UNAVAILABLE };
  }
  return { message: "Your email is verified." };
}

export async function resendVerificationAction(): Promise<FormState> {
  try {
    const user = await getSessionUser();
    if (!user) return { formError: "Please log in again." };
    const membership = await findMembership(user.id);
    if (!membership) return { formError: UNAVAILABLE };
    if (membership.emailVerified) return { message: "Your email is already verified." };
    if (!(await consumeLimit(LIMITS.resendVerifyPerUser, user.id))) return { formError: TOO_MANY };

    const token = await createVerificationToken(user.id);
    await sendEmail(verificationEmail({ to: user.email, name: membership.fullName, link: verifyLink(token) }));
  } catch (error) {
    console.error("Resending verification failed", error);
    return { formError: "We couldn't send the email. Please try again later." };
  }
  return { message: "Sent. Check your inbox (and spam folder)." };
}
