import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Add it to .env.local or Vercel before running migrations.");
}

const migrationDirectory = join(process.cwd(), "db", "migrations");
const migrations = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
const sql = neon(databaseUrl);

await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

for (const name of migrations) {
  const applied = await sql`SELECT 1 FROM schema_migrations WHERE name = ${name}`;
  if (applied.length > 0) continue;

  const content = await readFile(join(migrationDirectory, name), "utf8");
  const statements = content
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }
  await sql`INSERT INTO schema_migrations (name) VALUES (${name})`;
  console.log(`Applied ${name}`);
}
