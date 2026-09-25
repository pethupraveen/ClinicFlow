import { describe, expect, it } from "vitest";
import { DEMO_SESSION_TTL_SECONDS, hashDemoToken, newDemoToken } from "./session";

describe("demo session tokens", () => {
  it("creates opaque 256-bit tokens and stores only stable SHA-256 hashes", () => {
    const token = newDemoToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashDemoToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDemoToken(token)).toBe(hashDemoToken(token));
  });

  it("keeps a short-lived session window", () => {
    expect(DEMO_SESSION_TTL_SECONDS).toBe(14_400);
  });
});
