import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ENV, readEnv } from "@/lib/env";
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

/** Service-role client for admin operations. Never bound to a user's cookies. */
export function adminClient(): SupabaseClient {
  const url = readEnv(ENV.supabaseUrl);
  const serviceKey = readEnv(ENV.supabaseServiceKey);
  if (!url || !serviceKey) throw new AuthNotConfigured();
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
