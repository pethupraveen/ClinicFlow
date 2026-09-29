import "server-only";

import { database } from "@/lib/db";
import { newPublicId } from "@/modules/auth/tokens";
import { recordProductEvent } from "./events";
import { trimSeconds, type HoursRange } from "./schedule";
import type { OnboardingFacts } from "./steps";

// Every function takes the clinic's id from the caller's session membership.
// Lookups by public id always also filter on business_id.

export interface ClinicInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  mapsUrl: string;
}

export interface Doctor {
  publicId: string;
  name: string;
  specialty: string;
  appointmentMinutes: number;
  hours: HoursRange[];
}

export interface Faq {
  publicId: string;
  question: string;
  answer: string;
}

export async function getOnboardingFacts(businessId: string, emailVerified: boolean): Promise<OnboardingFacts> {
  const [row] = await database()<{
    clinic_ok: boolean;
    doctors: number;
    doctors_with_hours: number;
    faqs: number;
    faq_skipped: boolean;
    bot_tested: boolean;
  }[]>`
    SELECT
      (coalesce(b.phone, '') <> '' AND coalesce(b.address, '') <> '' AND coalesce(b.city, '') <> '') AS clinic_ok,
      (SELECT count(*)::int FROM doctors d WHERE d.business_id = b.id AND d.archived_at IS NULL) AS doctors,
      (SELECT count(DISTINCT d.id)::int FROM doctors d JOIN doctor_hours h ON h.doctor_id = d.id
         WHERE d.business_id = b.id AND d.archived_at IS NULL) AS doctors_with_hours,
      (SELECT count(*)::int FROM faqs f WHERE f.business_id = b.id) AS faqs,
      (o.faq_skipped_at IS NOT NULL) AS faq_skipped,
      (o.bot_tested_at IS NOT NULL) AS bot_tested
    FROM businesses b
    LEFT JOIN business_onboarding o ON o.business_id = b.id
    WHERE b.id = ${businessId}::uuid
  `;
  return {
    clinicInfoComplete: row?.clinic_ok ?? false,
    doctorCount: row?.doctors ?? 0,
    doctorsWithHours: row?.doctors_with_hours ?? 0,
    faqCount: row?.faqs ?? 0,
    faqSkipped: row?.faq_skipped ?? false,
    emailVerified,
    whatsappConnected: false, // Phase 6c
    botTested: row?.bot_tested ?? false,
  };
}

export async function rememberStep(businessId: string, step: number): Promise<void> {
  await database()`
    INSERT INTO business_onboarding (business_id, last_step) VALUES (${businessId}::uuid, ${step})
    ON CONFLICT (business_id) DO UPDATE SET last_step = EXCLUDED.last_step
  `;
}

// ---------- step 1: clinic info ----------

export async function getClinicInfo(businessId: string): Promise<ClinicInfo> {
  const [row] = await database()<{ name: string; phone: string | null; address: string | null; city: string | null; maps_url: string | null }[]>`
    SELECT name, phone, address, city, maps_url FROM businesses WHERE id = ${businessId}::uuid
  `;
  return { name: row.name, phone: row.phone ?? "", address: row.address ?? "", city: row.city ?? "", mapsUrl: row.maps_url ?? "" };
}

export async function saveClinicInfo(businessId: string, userId: string, info: ClinicInfo): Promise<void> {
  await database().begin(async (tx) => {
    await tx`
      UPDATE businesses
      SET name = ${info.name}, phone = ${info.phone}, address = ${info.address}, city = ${info.city},
          maps_url = ${info.mapsUrl || null}
      WHERE id = ${businessId}::uuid
    `;
    await recordProductEvent(tx, { businessId, userId, name: "clinic_info_saved" });
  });
}

// ---------- step 2 & 3: doctors and hours ----------

export async function listDoctors(businessId: string): Promise<Doctor[]> {
  const sql = database();
  const doctors = await sql<{ id: string; public_id: string; name: string; specialty: string; appointment_minutes: number }[]>`
    SELECT id, public_id, name, specialty, appointment_minutes
    FROM doctors
    WHERE business_id = ${businessId}::uuid AND archived_at IS NULL
    ORDER BY created_at
  `;
  if (doctors.length === 0) return [];
  const hours = await sql<{ doctor_id: string; weekday: number; start_time: string; end_time: string }[]>`
    SELECT doctor_id, weekday, start_time::text, end_time::text
    FROM doctor_hours
    WHERE business_id = ${businessId}::uuid AND doctor_id IN ${sql(doctors.map((d) => d.id))}
    ORDER BY weekday, start_time
  `;
  return doctors.map((d) => ({
    publicId: d.public_id,
    name: d.name,
    specialty: d.specialty,
    appointmentMinutes: d.appointment_minutes,
    hours: hours
      .filter((h) => h.doctor_id === d.id)
      .map((h) => ({ weekday: h.weekday, start: trimSeconds(h.start_time), end: trimSeconds(h.end_time) })),
  }));
}

export async function addDoctor(
  businessId: string,
  userId: string,
  doctor: { name: string; specialty: string; appointmentMinutes: number },
): Promise<void> {
  await database().begin(async (tx) => {
    await tx`
      INSERT INTO doctors (business_id, public_id, name, specialty, appointment_minutes)
      VALUES (${businessId}::uuid, ${newPublicId("d")}, ${doctor.name}, ${doctor.specialty}, ${doctor.appointmentMinutes})
    `;
    await recordProductEvent(tx, { businessId, userId, name: "doctor_added" });
  });
}

/** Returns false when the doctor isn't this clinic's (or no longer exists). */
export async function updateDoctor(
  businessId: string,
  publicId: string,
  doctor: { name: string; specialty: string; appointmentMinutes: number },
): Promise<boolean> {
  const rows = await database()`
    UPDATE doctors
    SET name = ${doctor.name}, specialty = ${doctor.specialty}, appointment_minutes = ${doctor.appointmentMinutes}, updated_at = now()
    WHERE business_id = ${businessId}::uuid AND public_id = ${publicId} AND archived_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/** Archived, not deleted: appointments will reference doctors (Phase 6b). */
export async function archiveDoctor(businessId: string, publicId: string): Promise<boolean> {
  const rows = await database()`
    UPDATE doctors SET archived_at = now(), updated_at = now()
    WHERE business_id = ${businessId}::uuid AND public_id = ${publicId} AND archived_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/** Replaces a doctor's weekly hours. Returns false if the doctor isn't this clinic's. */
export async function replaceDoctorHours(
  businessId: string,
  userId: string,
  publicId: string,
  ranges: HoursRange[],
): Promise<boolean> {
  return database().begin(async (tx) => {
    const [doctor] = await tx<{ id: string }[]>`
      SELECT id FROM doctors
      WHERE business_id = ${businessId}::uuid AND public_id = ${publicId} AND archived_at IS NULL
      FOR UPDATE
    `;
    if (!doctor) return false;
    await tx`DELETE FROM doctor_hours WHERE doctor_id = ${doctor.id}::uuid`;
    for (const r of ranges) {
      await tx`
        INSERT INTO doctor_hours (doctor_id, business_id, weekday, start_time, end_time)
        VALUES (${doctor.id}::uuid, ${businessId}::uuid, ${r.weekday}, ${r.start}::time, ${r.end}::time)
      `;
    }
    await recordProductEvent(tx, { businessId, userId, name: "schedule_saved", properties: { days: new Set(ranges.map((r) => r.weekday)).size } });
    return true;
  });
}

// ---------- step 4: FAQ ----------

export async function listFaqs(businessId: string): Promise<Faq[]> {
  const rows = await database()<{ public_id: string; question: string; answer: string }[]>`
    SELECT public_id, question, answer FROM faqs
    WHERE business_id = ${businessId}::uuid
    ORDER BY sort_order, created_at
  `;
  return rows.map((r) => ({ publicId: r.public_id, question: r.question, answer: r.answer }));
}

export async function addFaq(businessId: string, userId: string, faq: { question: string; answer: string }): Promise<void> {
  await database().begin(async (tx) => {
    await tx`
      INSERT INTO faqs (business_id, public_id, question, answer, sort_order)
      VALUES (${businessId}::uuid, ${newPublicId("q")}, ${faq.question}, ${faq.answer},
              (SELECT coalesce(max(sort_order), 0) + 1 FROM faqs WHERE business_id = ${businessId}::uuid))
    `;
    await recordProductEvent(tx, { businessId, userId, name: "faq_added" });
  });
}

export async function deleteFaq(businessId: string, publicId: string): Promise<void> {
  await database()`DELETE FROM faqs WHERE business_id = ${businessId}::uuid AND public_id = ${publicId}`;
}

export async function skipFaq(businessId: string, userId: string): Promise<void> {
  await database().begin(async (tx) => {
    await tx`
      INSERT INTO business_onboarding (business_id, faq_skipped_at) VALUES (${businessId}::uuid, now())
      ON CONFLICT (business_id) DO UPDATE SET faq_skipped_at = coalesce(business_onboarding.faq_skipped_at, now())
    `;
    await recordProductEvent(tx, { businessId, userId, name: "faq_skipped" });
  });
}
