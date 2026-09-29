import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { findMembership, type Membership } from "./accounts";
import { WELCOME } from "./redirects";
import { authClient, authConfig } from "./supabase";

export interface SessionUser {
  id: string;
  email: string;
  /** Name from the Google profile, used to prefill first-time setup. */
  name: string | null;
  /** Google only signs people in with addresses it has verified. */
  emailVerified: boolean;
}

/**
 * The signed-in user, verified with the Auth server (not just the cookie's
 * JWT), so signed-out or deleted sessions stop working immediately.
 * Cached per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!authConfig()) return null;
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user?.email) return null;
  const meta = user.user_metadata ?? {};
  const name = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null;
  return {
    id: user.id,
    email: user.email,
    name,
    emailVerified: meta.email_verified === true || Boolean(user.email_confirmed_at),
  };
});

/**
 * Gate for everything under /app. Signed-in users without a clinic yet are
 * sent to first-time setup. The clinic always comes from the user's
 * membership, never from the URL or a request body.
 */
export const requireMember = cache(
  async (nextPath = "/app"): Promise<{ user: SessionUser; membership: Membership }> => {
    const user = await getSessionUser();
    if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    const membership = await findMembership(user.id);
    if (!membership) redirect(WELCOME);
    return { user, membership };
  },
);
