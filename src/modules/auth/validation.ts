import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./passwordRules";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_LENGTH, "Use at most 72 characters.");

const text = (label: string, max: number) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, `Enter ${label}.`).max(max, `Keep ${label} under ${max} characters.`));

export const signupSchema = z.object({
  fullName: text("your name", 100),
  clinicName: text("your clinic name", 120),
  email,
  password: newPassword,
});

export const loginSchema = z.object({
  email,
  // Never hint at password rules on login; just require something.
  password: z.string().min(1, "Enter your password.").max(1024),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type FieldErrors = Partial<Record<string, string>>;

/** Reads the named string fields from a submitted form. */
export function formFields(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => {
    const value = formData.get(name);
    return [name, typeof value === "string" ? value : ""];
  }));
}

/** Flattens zod issues to the first message per field. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
