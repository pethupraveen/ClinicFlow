import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isSameOrigin, readSmallJson } from "./request";

describe("public analytics request protections", () => {
  it("allows a same-origin request and rejects a cross-site request", () => {
    const sameOrigin = new NextRequest("https://clinicflow.example/api/demo/events", {
      method: "POST",
      headers: { origin: "https://clinicflow.example" },
    });
    const crossSite = new NextRequest("https://clinicflow.example/api/demo/events", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });

    expect(isSameOrigin(sameOrigin)).toBe(true);
    expect(isSameOrigin(crossSite)).toBe(false);
  });

  it("rejects malformed and oversized JSON", async () => {
    const malformed = new Request("https://clinicflow.example/api/demo/events", { method: "POST", body: "{" });
    const oversized = new Request("https://clinicflow.example/api/demo/events", {
      method: "POST",
      headers: { "content-length": "4097" },
      body: "{}",
    });

    await expect(readSmallJson(malformed)).resolves.toBeNull();
    await expect(readSmallJson(oversized)).resolves.toBeNull();
  });
});
