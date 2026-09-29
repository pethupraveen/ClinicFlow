/**
 * Reads server configuration. Marketplace integrations may be connected with
 * a custom prefix (the live Supabase project uses `STORAGE_`), so each name is
 * also looked up with that prefix. The first non-empty candidate wins.
 */
const PREFIXES = ["", "STORAGE_"];

export function readEnv(names: readonly string[], env: Record<string, string | undefined> = process.env): string | undefined {
  for (const name of names) {
    for (const prefix of PREFIXES) {
      const value = env[prefix + name]?.trim();
      if (value) return value;
    }
  }
  return undefined;
}

export const ENV = {
  databaseUrl: ["POSTGRES_URL", "DATABASE_URL"],
  supabaseUrl: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  supabaseAnonKey: [
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ],
  supabaseServiceKey: ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  rateLimitSalt: ["AUTH_RATE_LIMIT_SALT"],
} as const;
