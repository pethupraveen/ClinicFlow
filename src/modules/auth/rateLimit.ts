import "server-only";

import { headers } from "next/headers";
import { database } from "@/lib/db";
import { ENV, readEnv } from "@/lib/env";
import { keyedHash } from "./tokens";

/**
 * Supabase Auth sees every request coming from Vercel's servers, so its
 * per-IP limits cannot tell visitors apart. These limits are ours.
 */
export const LIMITS = {
  googleStartPerIp: { bucket: "google-start:ip", max: 30, windowSeconds: 15 * 60 },
  createClinicPerIp: { bucket: "create-clinic:ip", max: 5, windowSeconds: 60 * 60 },
  testChatPerUser: { bucket: "test-chat:user", max: 200, windowSeconds: 60 * 60 },
} as const;

export type Limit = (typeof LIMITS)[keyof typeof LIMITS];

function salt(): string {
  // The service key is already a server-only secret, so it is a safe fallback.
  const value = readEnv(ENV.rateLimitSalt) ?? readEnv(ENV.supabaseServiceKey);
  if (!value) throw new Error("AUTH_RATE_LIMIT_SALT is not configured.");
  return value;
}

/** Salted hash of the caller's IP, or null when it cannot be determined. */
export async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? keyedHash(ip, salt()) : null;
}

/**
 * Records one attempt and reports whether the caller is still within the
 * limit. Attempts over the limit are not recorded, so a blocked caller's
 * window still expires.
 */
export async function consumeLimit(limit: Limit, key: string | null): Promise<boolean> {
  if (!key) return true;
  const keyHash = keyedHash(`${limit.bucket}:${key}`, salt());
  const sql = database();
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM rate_limit_hits
    WHERE bucket = ${limit.bucket} AND key_hash = ${keyHash}
      AND created_at > now() - make_interval(secs => ${limit.windowSeconds})
  `;
  if ((row?.count ?? 0) >= limit.max) return false;
  await sql`INSERT INTO rate_limit_hits (bucket, key_hash) VALUES (${limit.bucket}, ${keyHash})`;
  return true;
}
