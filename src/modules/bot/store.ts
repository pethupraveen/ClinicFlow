import "server-only";

import type { JSONValue } from "postgres";
import { database } from "@/lib/db";
import { newPublicId } from "@/modules/auth/tokens";
import { recordProductEvent } from "@/modules/onboarding/events";
import { trimSeconds } from "@/modules/onboarding/schedule";
import type { BotContext, BotMessage, BotInput, ConvState, UpcomingAppointment } from "./engine";
import { BOOKING_HORIZON_DAYS, openSlots, type DaySlots } from "./slots";

// Everything is scoped by the clinic's id; patients are identified by
// (business_id, phone), where the test chat uses a "test:<userId>" phone.

export type Channel = "TEST_CHAT" | "WHATSAPP";

export async function loadBotContext(businessId: string, patientPhone: string, now: Date): Promise<BotContext & { timeZone: string }> {
  const sql = database();
  const [clinic] = await sql<{ name: string; phone: string | null; address: string | null; city: string | null; maps_url: string | null; time_zone: string }[]>`
    SELECT name, phone, address, city, maps_url, time_zone FROM businesses WHERE id = ${businessId}::uuid
  `;
  const doctors = await sql<{ public_id: string; name: string; specialty: string }[]>`
    SELECT public_id, name, specialty FROM doctors
    WHERE business_id = ${businessId}::uuid AND archived_at IS NULL
    ORDER BY created_at
  `;
  const faqs = await sql<{ public_id: string; question: string; answer: string }[]>`
    SELECT public_id, question, answer FROM faqs WHERE business_id = ${businessId}::uuid ORDER BY sort_order, created_at
  `;
  const [patient] = await sql<{ name: string | null }[]>`
    SELECT name FROM patients WHERE business_id = ${businessId}::uuid AND phone = ${patientPhone}
  `;
  return {
    now,
    timeZone: clinic.time_zone,
    clinic: { name: clinic.name, phone: clinic.phone ?? "", address: clinic.address ?? "", city: clinic.city ?? "", mapsUrl: clinic.maps_url ?? "" },
    doctors: doctors.map((d) => ({ id: d.public_id, name: d.name, specialty: d.specialty })),
    faqs: faqs.map((f) => ({ id: f.public_id, question: f.question, answer: f.answer })),
    patientName: patient?.name ?? null,
  };
}

/** Open slots for one of this clinic's doctors. Test bookings never block real slots. */
export async function doctorOpenSlots(businessId: string, doctorPublicId: string, now: Date, timeZone: string): Promise<DaySlots[]> {
  const sql = database();
  const [doctor] = await sql<{ id: string; appointment_minutes: number }[]>`
    SELECT id, appointment_minutes FROM doctors
    WHERE business_id = ${businessId}::uuid AND public_id = ${doctorPublicId} AND archived_at IS NULL
  `;
  if (!doctor) return [];
  const hours = await sql<{ weekday: number; start_time: string; end_time: string }[]>`
    SELECT weekday, start_time::text, end_time::text FROM doctor_hours WHERE doctor_id = ${doctor.id}::uuid
  `;
  const horizonEnd = new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * 86_400_000);
  const booked = await sql<{ starts_at: Date; ends_at: Date }[]>`
    SELECT starts_at, ends_at FROM appointments
    WHERE doctor_id = ${doctor.id}::uuid AND status = 'BOOKED' AND NOT is_test
      AND starts_at < ${horizonEnd.toISOString()}::timestamptz AND ends_at > ${now.toISOString()}::timestamptz
  `;
  return openSlots({
    hours: hours.map((h) => ({ weekday: h.weekday, start: trimSeconds(h.start_time), end: trimSeconds(h.end_time) })),
    minutes: doctor.appointment_minutes,
    booked: booked.map((b) => ({ start: b.starts_at, end: b.ends_at })),
    now,
    timeZone,
  });
}

/**
 * Books one appointment. The exclusion constraint rejects an overlapping
 * real booking even under concurrent requests; that surfaces as { ok: false }.
 * The clinic's first booking through the engine activates it.
 */
export async function bookAppointment(input: {
  businessId: string;
  doctorPublicId: string;
  start: Date;
  patientPhone: string;
  patientName: string;
  channel: Channel;
  isTest: boolean;
  userId: string | null;
}): Promise<{ ok: true; ref: string } | { ok: false }> {
  try {
    return await database().begin(async (tx) => {
      const [doctor] = await tx<{ id: string; appointment_minutes: number }[]>`
        SELECT id, appointment_minutes FROM doctors
        WHERE business_id = ${input.businessId}::uuid AND public_id = ${input.doctorPublicId} AND archived_at IS NULL
      `;
      if (!doctor) return { ok: false as const };
      const [patient] = await tx<{ id: string }[]>`
        INSERT INTO patients (business_id, phone, name) VALUES (${input.businessId}::uuid, ${input.patientPhone}, ${input.patientName})
        ON CONFLICT (business_id, phone) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      const [{ appointment_seq: seq }] = await tx<{ appointment_seq: number }[]>`
        UPDATE businesses SET appointment_seq = appointment_seq + 1 WHERE id = ${input.businessId}::uuid RETURNING appointment_seq
      `;
      const ref = `A-${seq}`;
      const end = new Date(input.start.getTime() + doctor.appointment_minutes * 60_000);
      await tx`
        INSERT INTO appointments (business_id, public_id, ref, doctor_id, patient_id, starts_at, ends_at, channel, is_test)
        VALUES (${input.businessId}::uuid, ${newPublicId("a")}, ${ref}, ${doctor.id}::uuid, ${patient.id}::uuid,
                ${input.start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, ${input.channel}, ${input.isTest})
      `;
      await recordProductEvent(tx, {
        businessId: input.businessId,
        userId: input.userId,
        name: "appointment_booked",
        properties: { channel: input.channel, test: input.isTest },
      });
      // First booking through the bot engine activates the clinic (master plan §5).
      const first = await tx`
        INSERT INTO business_milestones (business_id, milestone) VALUES (${input.businessId}::uuid, 'first_appointment')
        ON CONFLICT DO NOTHING RETURNING milestone
      `;
      if (first.length > 0) {
        await tx`UPDATE businesses SET activated_at = coalesce(activated_at, now()) WHERE id = ${input.businessId}::uuid`;
      }
      if (input.isTest) {
        const tested = await tx`
          UPDATE business_onboarding SET bot_tested_at = now()
          WHERE business_id = ${input.businessId}::uuid AND bot_tested_at IS NULL
          RETURNING business_id
        `;
        if (tested.length > 0) await recordProductEvent(tx, { businessId: input.businessId, userId: input.userId, name: "bot_tested" });
      }
      return { ok: true as const, ref };
    });
  } catch (error) {
    // 23P01 = exclusion_violation: someone else took an overlapping slot.
    if (typeof error === "object" && error && "code" in error && error.code === "23P01") return { ok: false };
    throw error;
  }
}

export async function upcomingFor(businessId: string, patientPhone: string, now: Date): Promise<UpcomingAppointment[]> {
  const rows = await database()<{ ref: string; starts_at: Date; doctor: string }[]>`
    SELECT a.ref, a.starts_at, d.name AS doctor
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE a.business_id = ${businessId}::uuid AND p.phone = ${patientPhone}
      AND a.status = 'BOOKED' AND a.starts_at > ${now.toISOString()}::timestamptz
    ORDER BY a.starts_at
    LIMIT 20
  `;
  return rows.map((r) => ({ ref: r.ref, start: r.starts_at, doctorName: r.doctor }));
}

/** Cancels only this patient's own upcoming booking. */
export async function cancelFor(businessId: string, patientPhone: string, ref: string, now: Date, userId: string | null): Promise<boolean> {
  return database().begin(async (tx) => {
    const rows = await tx<{ channel: string; is_test: boolean }[]>`
      UPDATE appointments a SET status = 'CANCELLED', cancelled_at = now()
      FROM patients p
      WHERE a.patient_id = p.id AND a.business_id = ${businessId}::uuid AND p.phone = ${patientPhone}
        AND a.ref = ${ref} AND a.status = 'BOOKED' AND a.starts_at > ${now.toISOString()}::timestamptz
      RETURNING a.channel, a.is_test
    `;
    if (rows.length === 0) return false;
    await recordProductEvent(tx, {
      businessId,
      userId,
      name: "appointment_cancelled",
      properties: { channel: rows[0].channel, test: rows[0].is_test },
    });
    return true;
  });
}

// ---------- conversations ----------

export async function getConversation(businessId: string, channel: Channel, contact: string): Promise<{ id: string; state: ConvState }> {
  const [row] = await database()<{ id: string; state: ConvState }[]>`
    INSERT INTO conversations (business_id, channel, contact) VALUES (${businessId}::uuid, ${channel}, ${contact})
    ON CONFLICT (business_id, channel, contact) DO UPDATE SET contact = EXCLUDED.contact
    RETURNING id, state
  `;
  return { id: row.id, state: row.state ?? {} };
}

export async function saveTurn(input: { conversationId: string; businessId: string; state: ConvState; incoming: BotInput & { label?: string }; outgoing: BotMessage[] }): Promise<void> {
  await database().begin(async (tx) => {
    await tx`
      UPDATE conversations SET state = ${tx.json(input.state as JSONValue)}, last_message_at = now()
      WHERE id = ${input.conversationId}::uuid AND business_id = ${input.businessId}::uuid
    `;
    await tx`
      INSERT INTO conversation_messages (conversation_id, business_id, direction, body)
      VALUES (${input.conversationId}::uuid, ${input.businessId}::uuid, 'IN', ${tx.json(input.incoming as JSONValue)})
    `;
    for (const message of input.outgoing) {
      await tx`
        INSERT INTO conversation_messages (conversation_id, business_id, direction, body)
        VALUES (${input.conversationId}::uuid, ${input.businessId}::uuid, 'OUT', ${tx.json(message as unknown as JSONValue)})
      `;
    }
  });
}

export async function markNeedsHuman(conversationId: string, businessId: string): Promise<void> {
  await database()`
    UPDATE conversations SET needs_human_at = coalesce(needs_human_at, now())
    WHERE id = ${conversationId}::uuid AND business_id = ${businessId}::uuid
  `;
}

export interface TranscriptEntry {
  id: number;
  direction: "IN" | "OUT";
  body: BotMessage | (BotInput & { label?: string });
}

export async function transcript(businessId: string, channel: Channel, contact: string, limit = 60): Promise<TranscriptEntry[]> {
  const rows = await database()<TranscriptEntry[]>`
    SELECT m.id::int AS id, m.direction, m.body
    FROM conversation_messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.business_id = ${businessId}::uuid AND c.channel = ${channel} AND c.contact = ${contact}
    ORDER BY m.id DESC
    LIMIT ${limit}
  `;
  return rows.reverse();
}

export async function resetConversation(businessId: string, channel: Channel, contact: string): Promise<void> {
  await database()`
    DELETE FROM conversations WHERE business_id = ${businessId}::uuid AND channel = ${channel} AND contact = ${contact}
  `;
}

// ---------- clinic views ----------

export async function clinicTimeZone(businessId: string): Promise<string> {
  const [row] = await database()<{ time_zone: string }[]>`SELECT time_zone FROM businesses WHERE id = ${businessId}::uuid`;
  return row.time_zone;
}

export interface ClinicAppointment {
  ref: string;
  start: Date;
  end: Date;
  doctor: string;
  patient: string;
  status: "BOOKED" | "CANCELLED";
  channel: Channel;
  isTest: boolean;
}

export async function listAppointments(businessId: string, from: Date, to: Date): Promise<ClinicAppointment[]> {
  const rows = await database()<{ ref: string; starts_at: Date; ends_at: Date; doctor: string; patient: string | null; status: "BOOKED" | "CANCELLED"; channel: Channel; is_test: boolean }[]>`
    SELECT a.ref, a.starts_at, a.ends_at, d.name AS doctor, p.name AS patient, a.status, a.channel, a.is_test
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    JOIN patients p ON p.id = a.patient_id
    WHERE a.business_id = ${businessId}::uuid
      AND a.starts_at >= ${from.toISOString()}::timestamptz AND a.starts_at < ${to.toISOString()}::timestamptz
    ORDER BY a.starts_at, a.ref
    LIMIT 500
  `;
  return rows.map((r) => ({
    ref: r.ref,
    start: r.starts_at,
    end: r.ends_at,
    doctor: r.doctor,
    patient: r.patient ?? "Patient",
    status: r.status,
    channel: r.channel,
    isTest: r.is_test,
  }));
}
