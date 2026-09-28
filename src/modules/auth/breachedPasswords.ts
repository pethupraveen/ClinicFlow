import { createHash } from "node:crypto";

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 1_500;

/**
 * Checks a password against Have I Been Pwned using k-anonymity: only the
 * first five hex characters of its SHA-1 hash leave the server, and padded
 * responses hide which prefix was asked about. Fails open (returns false) on
 * any error or timeout so an outage there can never block signups.
 */
export async function isBreachedPassword(password: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const response = await fetchImpl(RANGE_URL + prefix, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return false;
    return rangeContains(await response.text(), suffix);
  } catch {
    return false;
  }
}

/** Parses `SUFFIX:COUNT` lines; padding entries have a count of 0. */
export function rangeContains(body: string, suffix: string): boolean {
  for (const line of body.split("\n")) {
    const [candidate, count] = line.trim().split(":");
    if (candidate === suffix && Number(count) > 0) return true;
  }
  return false;
}
