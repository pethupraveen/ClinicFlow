import type { CookieOptionsWithName } from "@supabase/ssr";
import { ENV, readEnv } from "@/lib/env";

// Only our server talks to Supabase Auth, so its cookies can be HttpOnly.
export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

export function authConfig(): { url: string; anonKey: string } | null {
  const url = readEnv(ENV.supabaseUrl);
  const anonKey = readEnv(ENV.supabaseAnonKey);
  return url && anonKey ? { url, anonKey } : null;
}
