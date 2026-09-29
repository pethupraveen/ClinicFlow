import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AUTH_COOKIE_OPTIONS, authConfig } from "./config";

export { authConfig } from "./config";

export class AuthNotConfigured extends Error {
  constructor() {
    super("Supabase Auth is not configured.");
  }
}

/**
 * Per-request client bound to the auth cookies. Cookie writes only succeed in
 * server actions and route handlers; in server components the proxy has
 * already refreshed the session, so the failed write is safe to ignore.
 */
export async function authClient(): Promise<SupabaseClient> {
  const config = authConfig();
  if (!config) throw new AuthNotConfigured();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a server component.
        }
      },
    },
  });
}
