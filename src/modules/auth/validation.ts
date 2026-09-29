import { z } from "zod";

const text = (label: string, max: number) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, `Enter ${label}.`).max(max, `Keep ${label} under ${max} characters.`));

/** First-time setup after Google sign-in: the one thing Google can't tell us. */
export const welcomeSchema = z.object({
  fullName: text("your name", 100),
  clinicName: text("your clinic name", 120),
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
