/**
 * Fictional demo clinic. Everything here is hard-coded sample data that lives
 * only in the visitor's browser — the demo never reads or writes real clinic
 * data, and nothing in this module may import from tenant modules.
 */

export const DEMO_CLINIC_NAME = "SmileCare Dental Clinic";
export const DEMO_APPOINTMENT_ID = "DEMO-1001";
export const DEMO_PATIENT_NAME = "Demo Patient";

export const DOCTORS = [
  { id: "arun", label: "Dr. Arun", specialty: "Dentist", fee: "₹400" },
  { id: "priya", label: "Dr. Priya", specialty: "Orthodontist", fee: "₹600" },
] as const;

export type DoctorId = (typeof DOCTORS)[number]["id"];

/** Offered slots. 9:30 AM is already taken with the chosen doctor (see dashboard). */
export const SLOTS = ["10:00 AM", "10:30 AM", "11:00 AM"] as const;
export type Slot = (typeof SLOTS)[number];

export const TAKEN_SLOT = "9:30 AM";

export const RECEPTIONIST_NAME = "Kavya";

export const CLINIC_INFO_TEXT = [
  "🕘 Timings: Mon–Sat, 9:00 AM – 7:00 PM (closed Sunday)",
  "📍 Address: 12 Demo Street, Anna Nagar, Chennai",
  `💳 Consultation fees: Dr. Arun ${DOCTORS[0].fee} · Dr. Priya ${DOCTORS[1].fee}`,
  "🗺️ Google Maps: a location link is shared here",
].join("\n");

export function doctorById(id: DoctorId) {
  return DOCTORS.find((d) => d.id === id)!;
}

export function otherDoctor(id: DoctorId) {
  return DOCTORS.find((d) => d.id !== id)!;
}

/** Minutes since midnight, for sorting "10:30 AM"-style times. */
export function timeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
  if (!m) return 0;
  const h = (Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0);
  return h * 60 + Number(m[2]);
}

export interface DemoAppointment {
  time: string;
  patient: string;
  doctor: string;
  via: "WhatsApp" | "Phone call";
  isNew: boolean;
}

/**
 * The simulated clinic's appointment list for the booked day. Patient A and B
 * are with the *other* doctor, so the slots offered in the chat stay truthful;
 * Patient C holds the taken 9:30 slot with the chosen doctor.
 */
export function dashboardAppointments(booking: { doctorId: DoctorId; slot: Slot } | null): DemoAppointment[] {
  const chosen = doctorById(booking?.doctorId ?? "arun");
  const other = otherDoctor(chosen.id);
  const rows: DemoAppointment[] = [
    { time: TAKEN_SLOT, patient: "Patient C", doctor: chosen.label, via: "Phone call", isNew: false },
    { time: "10:00 AM", patient: "Patient A", doctor: other.label, via: "WhatsApp", isNew: false },
    { time: "11:00 AM", patient: "Patient B", doctor: other.label, via: "WhatsApp", isNew: false },
  ];
  if (booking) {
    rows.push({ time: booking.slot, patient: DEMO_PATIENT_NAME, doctor: chosen.label, via: "WhatsApp", isNew: true });
  }
  return rows.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time) || Number(a.isNew) - Number(b.isNew));
}

export const OTHER_PATIENTS = [
  { name: "Patient A", detail: "Last visit 12 days ago" },
  { name: "Patient B", detail: "Last visit 3 weeks ago" },
  { name: "Patient C", detail: "First visit" },
];

export const OTHER_CONVERSATIONS = [
  { name: "Patient D", preview: "What are your timings on Saturday?", status: "Answered by FAQ" as const },
  { name: "Patient E", preview: "Talk to Reception", status: "Waiting for reception" as const },
];
