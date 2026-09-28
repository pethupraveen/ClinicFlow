import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { findMembership, type Membership } from "./accounts";
import { authClient, authConfig } from "./supabase";

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * The signed-in user, verified with the Auth server (not just the cookie's
 * JWT), so sessions revoked by a password reset stop working immediately.
 * Cached per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!authConfig()) return null;
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
});

export type AppAccess =
  | { kind: "member"; user: SessionUser; membership: Membership }
  | { kind: "no-membership"; user: SessionUser };

/**
 * Gate for everything under /app. The clinic always comes from the user's
 * membership, never from the URL or a request body.
 */
export const requireAppAccess = cache(async (nextPath = "/app"): Promise<AppAccess> => {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const membership = await findMembership(user.id);
  if (!membership) {
    console.error("Signed-in user has no clinic membership", { userId: user.id });
    return { kind: "no-membership", user };
  }
  return { kind: "member", user, membership };
});
