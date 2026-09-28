import { createHash, createHmac, randomBytes } from "node:crypto";

export const VERIFY_EMAIL_TTL_SECONDS = 48 * 60 * 60;

/** 256-bit random token; only its hash is ever stored. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Keyed hash for values such as IP addresses that must not be reversible by brute force. */
export function keyedHash(value: string, salt: string): string {
  return createHmac("sha256", salt).update(value).digest("hex");
}

const PUBLIC_ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/** Non-sequential identifier safe to show in URLs, e.g. `c_7k2m9x4p1q8r`. */
export function newPublicId(prefix: string): string {
  const bytes = randomBytes(12);
  let id = "";
  for (const byte of bytes) id += PUBLIC_ID_ALPHABET[byte % 32];
  return `${prefix}_${id}`;
}
