import "server-only";

import postgres, { type Sql } from "postgres";
import { ENV, readEnv } from "./env";

export class DatabaseUnavailable extends Error {
  constructor() {
    super("Database is not configured.");
  }
}

// Supabase's Vercel integration appends non-Postgres query parameters
// (e.g. `supa`, `pgbouncer`) that postgres.js would forward to the server as
// startup settings, so keep only `sslmode`.
function cleanConnectionString(raw: string): string {
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (key !== "sslmode") url.searchParams.delete(key);
  }
  return url.toString();
}

let client: Sql | undefined;

/** Shared pool on Supabase's pooled (transaction mode) connection. */
export function database(): Sql {
  if (client) return client;
  const connectionString = readEnv(ENV.databaseUrl);
  if (!connectionString) throw new DatabaseUnavailable();
  // The transaction pooler does not support prepared statements.
  client = postgres(cleanConnectionString(connectionString), { prepare: false, max: 5, idle_timeout: 20 });
  return client;
}
