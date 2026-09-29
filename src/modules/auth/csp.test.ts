import { describe, expect, it } from "vitest";
import { readEnv } from "@/lib/env";
import { buildCsp, newNonce, usesNonceCsp } from "./csp";
import { keyedHash, newPublicId } from "./tokens";

describe("nonce CSP scope", () => {
  it("covers auth pages and the app, not marketing or demo", () => {
    for (const path of ["/app", "/app/billing", "/signup", "/login", "/welcome", "/auth/google", "/auth/callback"]) {
      expect(usesNonceCsp(path)).toBe(true);
    }
    for (const path of ["/", "/demo", "/book-demo", "/application", "/signups"]) {
      expect(usesNonceCsp(path)).toBe(false);
    }
  });

  it("builds a strict script policy with a fresh nonce", () => {
    const nonce = newNonce();
    expect(nonce).not.toBe(newNonce());
    const csp = buildCsp(nonce, false);
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(buildCsp(nonce, true)).toContain("'unsafe-eval'");
  });
});

describe("tokens", () => {
  it("keys hashes with a salt", () => {
    expect(keyedHash("203.0.113.9", "a")).not.toBe(keyedHash("203.0.113.9", "b"));
  });

  it("makes non-sequential public ids", () => {
    expect(newPublicId("c")).toMatch(/^c_[0-9a-hjkmnp-tv-z]{12}$/);
    expect(newPublicId("c")).not.toBe(newPublicId("c"));
  });
});

describe("readEnv", () => {
  it("accepts plain and STORAGE_-prefixed names, first non-empty wins", () => {
    expect(readEnv(["POSTGRES_URL"], { STORAGE_POSTGRES_URL: "prefixed" })).toBe("prefixed");
    expect(readEnv(["POSTGRES_URL"], { POSTGRES_URL: "plain", STORAGE_POSTGRES_URL: "prefixed" })).toBe("plain");
    expect(readEnv(["A", "B"], { A: " ", B: "b" })).toBe("b");
    expect(readEnv(["A"], {})).toBeUndefined();
  });
});
