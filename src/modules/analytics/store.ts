import "server-only";

import postgres, { type Sql } from "postgres";
import type { DemoEventName, MarketingPage } from "./events";

export class AnalyticsStoreUnavailable extends Error {
  constructor() {
    super("Analytics storage is not configured.");
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

function database(): Sql {
  if (client) return client;
  // POSTGRES_URL is Supabase's pooled (transaction mode) connection.
  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new AnalyticsStoreUnavailable();
  // The transaction pooler does not support prepared statements.
  client = postgres(cleanConnectionString(connectionString), { prepare: false, max: 5, idle_timeout: 20 });
  return client;
}

type SessionRow = { id: string };
type CountRow = { count: number | string };

function countOf(rows: readonly CountRow[]): number {
  return Number(rows[0]?.count ?? 0);
}

export async function findActiveDemoSession(tokenHash: string): Promise<string | null> {
  const sql = database();
  const rows = await sql<SessionRow[]>`
    UPDATE demo_sessions
    SET last_seen_at = now()
    WHERE token_hash = ${tokenHash} AND expires_at > now()
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

export async function createDemoSession(input: {
  id: string;
  visitorId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<"created" | "rate_limited"> {
  const sql = database();
  const recent = await sql<CountRow[]>`
    SELECT count(*)::int AS count
    FROM demo_sessions
    WHERE visitor_id = ${input.visitorId}::uuid AND created_at > now() - interval '1 hour'
  `;
  if (countOf(recent) >= 20) return "rate_limited";

  await sql.begin((tx) => [
    tx`
      INSERT INTO demo_sessions (id, visitor_id, token_hash, expires_at)
      VALUES (${input.id}::uuid, ${input.visitorId}::uuid, ${input.tokenHash}, ${input.expiresAt.toISOString()}::timestamptz)
    `,
    tx`
      INSERT INTO demo_events (demo_session_id, name)
      VALUES (${input.id}::uuid, 'demo_started')
    `,
  ]);
  return "created";
}

export async function recordDemoEvents(tokenHash: string, events: DemoEventName[]): Promise<"recorded" | "missing" | "rate_limited"> {
  const sql = database();
  const sessionId = await findActiveDemoSession(tokenHash);
  if (!sessionId) return "missing";

  const recent = await sql<CountRow[]>`
    SELECT count(*)::int AS count
    FROM demo_events
    WHERE demo_session_id = ${sessionId}::uuid AND occurred_at > now() - interval '1 minute'
  `;
  if (countOf(recent) + events.length > 120) return "rate_limited";

  await sql.begin((tx) => events.map((name) => tx`
    INSERT INTO demo_events (demo_session_id, name)
    VALUES (${sessionId}::uuid, ${name})
  `));
  return "recorded";
}

export async function recordMarketingPageView(visitorId: string, page: MarketingPage): Promise<"recorded" | "rate_limited"> {
  const sql = database();
  const recent = await sql<CountRow[]>`
    SELECT count(*)::int AS count
    FROM marketing_events
    WHERE visitor_id = ${visitorId}::uuid AND occurred_at > now() - interval '1 hour'
  `;
  if (countOf(recent) >= 30) return "rate_limited";

  await sql`
    INSERT INTO marketing_events (visitor_id, name, page)
    VALUES (${visitorId}::uuid, 'marketing_page_viewed', ${page})
  `;
  return "recorded";
}
