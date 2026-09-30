import "server-only";

import { notFound } from "next/navigation";
import { ENV, readEnv } from "@/lib/env";
import { getSessionUser, type SessionUser } from "@/modules/auth/guards";
import { isStaffEmail } from "./staffList";

/**
 * ClinicFlow staff only (emails in CLINICFLOW_STAFF_EMAILS). Everyone else,
 * signed in or not, gets a plain 404 so the area isn't discoverable (§10).
 */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !user.emailVerified || !isStaffEmail(user.email, readEnv(ENV.staffEmails))) notFound();
  return user;
}
