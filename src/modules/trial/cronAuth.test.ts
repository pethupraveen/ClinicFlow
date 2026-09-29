import { describe, expect, it } from "vitest";
import { checkCronAuth } from "./cronAuth";

describe("checkCronAuth", () => {
  it("stays closed when no secret is configured", () => {
    expect(checkCronAuth("Bearer anything", undefined)).toBe("not-configured");
    expect(checkCronAuth(null, "")).toBe("not-configured");
  });

  it("accepts only the exact bearer secret", () => {
    expect(checkCronAuth("Bearer s3cret", "s3cret")).toBe("ok");
    expect(checkCronAuth("Bearer wrong", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth("s3cret", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth(null, "s3cret")).toBe("unauthorized");
  });
});
