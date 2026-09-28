import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

// Migrations need a direct (session) connection; fall back to the pooled one.
const databaseUrl = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("POSTGRES_URL_NON_POOLING is required. Connect Supabase in Vercel and pull the environment before running migrations.");
}

// Drop Supabase-specific query parameters (`supa`, `pgbouncer`) that Postgres rejects.
const url = new URL(databaseUrl);
for (const key of [...url.searchParams.keys()]) {
  if (key !== "sslmode") url.searchParams.delete(key);
}

const migrationDirectory = join(process.cwd(), "db", "migrations");
const migrations = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
const sql = postgres(url.toString(), { prepare: false, max: 1, onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  for (const name of migrations) {
    const applied = await sql`SELECT 1 FROM schema_migrations WHERE name = ${name}`;
    if (applied.length > 0) continue;

    const content = await readFile(join(migrationDirectory, name), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
    });
    console.log(`Applied ${name}`);
  }
} finally {
  await sql.end();
}
