import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it("keeps app paths and their query", () => {
    expect(safeNextPath("/app")).toBe("/app");
    expect(safeNextPath("/app/billing?tab=plans")).toBe("/app/billing?tab=plans");
  });

  it.each([
    ["https://evil.example/app"],
    ["//evil.example/app"],
    ["/\\evil.example"],
    ["\\\\evil.example"],
    ["javascript:alert(1)"],
    ["/login"],
    ["/welcome"],
    ["/reset-password"],
    ["/application"],
    ["/app/../admin"],
    [""],
    [undefined],
    [["/app"]],
    ["/app" + "x".repeat(600)],
  ])("falls back for %j", (value) => {
    expect(safeNextPath(value)).toBe("/app");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("https://evil.example", "/app/settings")).toBe("/app/settings");
  });
});
