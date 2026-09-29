"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireMember } from "@/modules/auth/guards";
import { fieldErrors, formFields, type FieldErrors } from "@/modules/auth/validation";
import { parseWeeklyHours, type ScheduleErrors } from "./schedule";
import {
  addDoctor,
  addFaq,
  archiveDoctor,
  deleteFaq,
  listDoctors,
  rememberStep,
  replaceDoctorHours,
  saveClinicInfo,
  skipFaq,
  updateDoctor,
} from "./store";
import { clinicInfoSchema, doctorSchema, faqSchema } from "./validation";

export interface StepFormState {
  fieldErrors?: FieldErrors;
  dayErrors?: ScheduleErrors;
  formError?: string;
  message?: string;
  /** Set on success so add-forms can remount empty. */
  savedAt?: number;
  values?: Record<string, string>;
}

const FAILED = "Something went wrong saving that. Please try again.";

/** Only owners and admins may change clinic setup; the clinic comes from the session. */
async function editor() {
  const { user, membership } = await requireMember("/app/onboarding");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new Error("Only clinic owners and admins can change setup.");
  }
  return { userId: user.id, businessId: membership.business.id };
}

/** "Save and continue later" returns to the dashboard; otherwise go to the next step. */
function afterSave(formData: FormData, nextStep: number): never {
  if (formData.get("intent") === "later") redirect("/app");
  redirect(`/app/onboarding/${nextStep}`);
}

function failure(error: unknown, values?: Record<string, string>): StepFormState {
  unstable_rethrow(error);
  console.error("Onboarding save failed", error);
  return { formError: error instanceof Error && error.message.startsWith("Only clinic") ? error.message : FAILED, values };
}

export async function saveClinicInfoAction(_prev: StepFormState, formData: FormData): Promise<StepFormState> {
  const raw = formFields(formData, ["name", "phone", "address", "city", "mapsUrl"]);
  const parsed = clinicInfoSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };
  try {
    const { businessId, userId } = await editor();
    await saveClinicInfo(businessId, userId, parsed.data);
    await rememberStep(businessId, 2);
  } catch (error) {
    return failure(error, raw);
  }
  afterSave(formData, 2);
}

export async function addDoctorAction(_prev: StepFormState, formData: FormData): Promise<StepFormState> {
  const raw = formFields(formData, ["name", "specialty", "appointmentMinutes"]);
  const parsed = doctorSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };
  try {
    const { businessId, userId } = await editor();
    await addDoctor(businessId, userId, parsed.data);
  } catch (error) {
    return failure(error, raw);
  }
  refresh();
  return { message: `${parsed.data.name} added.`, savedAt: Date.now() };
}

export async function updateDoctorAction(_prev: StepFormState, formData: FormData): Promise<StepFormState> {
  const raw = formFields(formData, ["doctor", "name", "specialty", "appointmentMinutes"]);
  const parsed = doctorSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };
  try {
    const { businessId } = await editor();
    if (!(await updateDoctor(businessId, raw.doctor, parsed.data))) return { formError: "That doctor no longer exists." };
  } catch (error) {
    return failure(error, raw);
  }
  refresh();
  return { message: "Saved." };
}

export async function archiveDoctorAction(formData: FormData): Promise<void> {
  const { businessId } = await editor();
  await archiveDoctor(businessId, formFields(formData, ["doctor"]).doctor);
  refresh();
}

export async function saveHoursAction(_prev: StepFormState, formData: FormData): Promise<StepFormState> {
  const doctorId = formFields(formData, ["doctor"]).doctor;
  try {
    const { businessId, userId } = await editor();
    const doctor = (await listDoctors(businessId)).find((d) => d.publicId === doctorId);
    if (!doctor) return { formError: "That doctor no longer exists." };
    const parsed = parseWeeklyHours(formData, doctor.appointmentMinutes);
    if (!parsed.ok) return { dayErrors: parsed.errors };
    if (parsed.ranges.length === 0) return { formError: "Tick at least one working day." };
    await replaceDoctorHours(businessId, userId, doctorId, parsed.ranges);
    await rememberStep(businessId, 3);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { message: "Working hours saved." };
}

export async function addFaqAction(_prev: StepFormState, formData: FormData): Promise<StepFormState> {
  const raw = formFields(formData, ["question", "answer"]);
  const parsed = faqSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };
  try {
    const { businessId, userId } = await editor();
    await addFaq(businessId, userId, parsed.data);
    await rememberStep(businessId, 4);
  } catch (error) {
    return failure(error, raw);
  }
  refresh();
  return { message: "Question added.", savedAt: Date.now() };
}

export async function deleteFaqAction(formData: FormData): Promise<void> {
  const { businessId } = await editor();
  await deleteFaq(businessId, formFields(formData, ["faq"]).faq);
  refresh();
}

export async function skipFaqAction(): Promise<void> {
  const { businessId, userId } = await editor();
  await skipFaq(businessId, userId);
  redirect("/app");
}
