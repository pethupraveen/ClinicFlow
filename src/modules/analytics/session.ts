import { createHash, randomBytes, randomUUID } from "node:crypto";

export const DEMO_COOKIE = "cf_demo";
export const DEMO_SESSION_TTL_SECONDS = 4 * 60 * 60;

export function newDemoToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDemoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionId(): string {
  return randomUUID();
}
