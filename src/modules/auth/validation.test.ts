import { describe, expect, it } from "vitest";
import { fieldErrors, formFields, welcomeSchema } from "./validation";

describe("welcomeSchema", () => {
  it("normalises whitespace in names", () => {
    const parsed = welcomeSchema.parse({ fullName: "  Asha   Rao ", clinicName: " Sunrise  Dental " });
    expect(parsed).toEqual({ fullName: "Asha Rao", clinicName: "Sunrise Dental" });
  });

  it("reports one message per invalid field", () => {
    const result = welcomeSchema.safeParse({ fullName: " ", clinicName: "x".repeat(121) });
    expect(result.success).toBe(false);
    const errors = fieldErrors(result.error!);
    expect(errors.fullName).toBe("Enter your name.");
    expect(errors.clinicName).toMatch(/under 120/);
  });
});

describe("formFields", () => {
  it("reads strings and ignores files or missing fields", () => {
    const data = new FormData();
    data.set("clinicName", "Sunrise Dental");
    data.set("upload", new Blob(["x"]));
    expect(formFields(data, ["clinicName", "upload", "missing"])).toEqual({ clinicName: "Sunrise Dental", upload: "", missing: "" });
  });
});
