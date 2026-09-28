export const EXISTING_ACCOUNT_MESSAGE =
  "An account with this email may already exist — log in or reset your password.";
export const SIGNUP_FAILED_MESSAGE = "We couldn't create your account. Please try again in a moment.";

export type SignUpResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "exists" | "rejected" | "failed"; message?: string };

export interface SignupDeps {
  signUp(email: string, password: string, fullName: string): Promise<SignUpResult>;
  /** One transaction; returns the raw verification token. */
  createRecords(userId: string): Promise<{ verifyToken: string }>;
  deleteAuthUser(userId: string): Promise<void>;
  signOutLocal(): Promise<void>;
  sendVerification(verifyToken: string): Promise<void>;
  logError(message: string, error: unknown): void;
}

export type SignupOutcome = { ok: true } | { ok: false; formError: string };

/**
 * Supabase creates the auth user over HTTP, outside our transaction. If our
 * own rows then fail, the auth user is deleted again so no account exists
 * without a clinic. The verification email is best effort: the app banner
 * offers a resend.
 */
export async function registerAccount(
  input: { email: string; password: string; fullName: string },
  deps: SignupDeps,
): Promise<SignupOutcome> {
  const created = await deps.signUp(input.email, input.password, input.fullName);
  if (!created.ok) {
    if (created.reason === "exists") return { ok: false, formError: EXISTING_ACCOUNT_MESSAGE };
    if (created.reason === "rejected" && created.message) return { ok: false, formError: created.message };
    return { ok: false, formError: SIGNUP_FAILED_MESSAGE };
  }

  let verifyToken: string;
  try {
    ({ verifyToken } = await deps.createRecords(created.userId));
  } catch (error) {
    deps.logError("Signup records failed; removing the auth user", error);
    await deps.signOutLocal().catch((e) => deps.logError("Sign-out after failed signup failed", e));
    await deps.deleteAuthUser(created.userId).catch((e) => deps.logError("Deleting orphaned auth user failed", e));
    return { ok: false, formError: SIGNUP_FAILED_MESSAGE };
  }

  await deps.sendVerification(verifyToken).catch((e) => deps.logError("Verification email failed", e));
  return { ok: true };
}
