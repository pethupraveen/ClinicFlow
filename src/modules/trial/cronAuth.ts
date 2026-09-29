import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuth = "ok" | "unauthorized" | "not-configured";

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Compared in
 * constant time; without a configured secret the endpoint stays closed.
 */
export function checkCronAuth(authorization: string | null, secret: string | undefined): CronAuth {
  if (!secret) return "not-configured";
  if (!authorization) return "unauthorized";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`)) ? "ok" : "unauthorized";
}
