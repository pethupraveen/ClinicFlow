import { describe, expect, it } from "vitest";
import { fieldErrors, formFields, loginSchema, resetPasswordSchema, signupSchema } from "./validation";

const valid = { fullName: "  Asha   Rao ", clinicName: "Sunrise Dental", email: " Owner@Clinic.Example ", password: "a long password" };

describe("signupSchema", () => {
  it("normalises names and email", () => {
    const parsed = signupSchema.parse(valid);
    expect(parsed.fullName).toBe("Asha Rao");
    expect(parsed.email).toBe("owner@clinic.example");
  });

  it("reports one message per invalid field", () => {
    const result = signupSchema.safeParse({ fullName: " ", clinicName: "", email: "nope", password: "short" });
    expect(result.success).toBe(false);
    const errors = fieldErrors(result.error!);
    expect(Object.keys(errors).sort()).toEqual(["clinicName", "email", "fullName", "password"]);
    expect(errors.password).toMatch(/10 characters/);
  });

  it("rejects passwords beyond bcrypt's 72-byte limit, counting bytes", () => {
    expect(signupSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
    expect(signupSchema.safeParse({ ...valid, password: "é".repeat(37) }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not apply signup password rules", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    const result = resetPasswordSchema.safeParse({ password: "a long password", confirmPassword: "different one" });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).confirmPassword).toBe("Passwords do not match.");
  });
});

describe("formFields", () => {
  it("reads strings and ignores files or missing fields", () => {
    const data = new FormData();
    data.set("email", "a@b.co");
    data.set("upload", new Blob(["x"]));
    expect(formFields(data, ["email", "upload", "missing"])).toEqual({ email: "a@b.co", upload: "", missing: "" });
  });
});
