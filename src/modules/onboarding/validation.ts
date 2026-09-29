import { z } from "zod";
import { APPOINTMENT_LENGTHS } from "./schedule";

const text = (label: string, max: number, min = 1) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(min, `Enter ${label}.`).max(max, `Keep ${label} under ${max} characters.`));

export const clinicInfoSchema = z.object({
  name: text("the clinic name", 120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{6,18}$/, "Enter a phone number, e.g. +91 98765 43210."),
  address: text("the address", 300),
  city: text("the city", 80),
  mapsUrl: z
    .string()
    .trim()
    .max(500, "That link is too long.")
    .refine((value) => {
      if (!value) return true;
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Paste a full https:// link, e.g. from Google Maps → Share."),
});

export const doctorSchema = z.object({
  name: text("the doctor's name", 100),
  specialty: text("a specialty", 80, 0),
  appointmentMinutes: z.coerce
    .number()
    .refine((n) => (APPOINTMENT_LENGTHS as readonly number[]).includes(n), "Choose an appointment length."),
});

export const faqSchema = z.object({
  question: text("a question", 200),
  answer: text("an answer", 1000),
});
