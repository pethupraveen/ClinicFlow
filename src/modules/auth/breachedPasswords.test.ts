import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { isBreachedPassword, rangeContains } from "./breachedPasswords";

const PASSWORD = "correct horse battery";
const hash = createHash("sha1").update(PASSWORD).digest("hex").toUpperCase();
const prefix = hash.slice(0, 5);
const suffix = hash.slice(5);

function respond(body: string, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(body, { status }));
}

describe("isBreachedPassword", () => {
  it("sends only the 5-character hash prefix, with padding", async () => {
    const fetchImpl = respond("");
    await isBreachedPassword(PASSWORD, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${prefix}`);
    expect(String(url)).not.toContain(suffix);
    expect(new Headers(init?.headers).get("Add-Padding")).toBe("true");
  });

  it("detects a listed suffix", async () => {
    expect(await isBreachedPassword(PASSWORD, respond(`AAAA:1\r\n${suffix}:42\r\nBBBB:3`))).toBe(true);
  });

  it("ignores padding entries with a zero count", async () => {
    expect(await isBreachedPassword(PASSWORD, respond(`${suffix}:0`))).toBe(false);
  });

  it("fails open on errors and bad responses", async () => {
    expect(await isBreachedPassword(PASSWORD, respond("", 503))).toBe(false);
    expect(await isBreachedPassword(PASSWORD, vi.fn<typeof fetch>(async () => { throw new Error("timeout"); }))).toBe(false);
  });
});

describe("rangeContains", () => {
  it("matches whole suffixes only", () => {
    expect(rangeContains("ABCDEF:2", "ABCDE")).toBe(false);
    expect(rangeContains("ABCDE:2", "ABCDE")).toBe(true);
  });
});
