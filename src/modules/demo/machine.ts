/**
 * The interactive demo as a pure state machine (plan §3).
 *
 *   Welcome ─┬─ Book Appointment ─▶ ChooseDoctor ─▶ ChooseDate ─▶ ChooseSlot ─▶ Confirm ─┬─ Confirm ─▶ Booked
 *            ├─ Clinic Information ─▶ ClinicInfo ─ Back to menu ─▶ Welcome            └─ Change time ─▶ ChooseSlot
 *            └─ Talk to Reception ─▶ Handoff ─ Back to menu ─▶ Welcome
 *   Booked ─(auto / button)─▶ Dashboard ─▶ Conversion        RESTART from anywhere ─▶ Welcome
 *
 * Every transition is validated against the options the current state offers,
 * so a tampered sessionStorage payload or a stale click can't jump states.
 */
import { dateOptions, type DateOption } from "./dates";
import {
  CLINIC_INFO_TEXT,
  DEMO_APPOINTMENT_ID,
  DEMO_CLINIC_NAME,
  DOCTORS,
  RECEPTIONIST_NAME,
  SLOTS,
  doctorById,
  type DoctorId,
  type Slot,
} from "./fixtures";

export const STATES = [
  "welcome",
  "clinicInfo",
  "handoff",
  "chooseDoctor",
  "chooseDate",
  "chooseSlot",
  "confirm",
  "booked",
  "dashboard",
  "conversion",
] as const;
export type StateName = (typeof STATES)[number];

export type Sender = "bot" | "patient" | "staff";

export interface Message {
  id: number;
  from: Sender;
  text: string;
}

export interface Option {
  id: string;
  label: string;
}

export interface DemoState {
  v: 1;
  state: StateName;
  messages: Message[];
  doctorId?: DoctorId;
  dateOptions?: DateOption[];
  date?: DateOption;
  slot?: Slot;
  /** Epoch ms of the visitor's first choice. */
  startedAt?: number;
  bookedAt?: number;
  completedAt?: number;
}

export type DemoEvent =
  | { type: "CHOOSE"; option: string; now: number }
  | { type: "SHOW_DASHBOARD" }
  | { type: "COMPLETE"; now: number }
  | { type: "RESTART" };

const WELCOME_TEXT = `👋 Welcome to ${DEMO_CLINIC_NAME}.\nHow can I help you?`;
const MENU_AGAIN_TEXT = "Is there anything else I can help you with?";

const WELCOME_OPTIONS: Option[] = [
  { id: "book", label: "Book Appointment" },
  { id: "info", label: "Clinic Information" },
  { id: "reception", label: "Talk to Reception" },
];
const BACK_TO_MENU: Option[] = [{ id: "menu", label: "Back to menu" }];
const CONFIRM_OPTIONS: Option[] = [
  { id: "confirm", label: "Confirm" },
  { id: "change", label: "Change time" },
];

export function initialState(): DemoState {
  return { v: 1, state: "welcome", messages: [{ id: 1, from: "bot", text: WELCOME_TEXT }] };
}

/** The reply buttons the patient can tap in the current state. */
export function optionsFor(s: DemoState): Option[] {
  switch (s.state) {
    case "welcome":
      return WELCOME_OPTIONS;
    case "clinicInfo":
    case "handoff":
      return BACK_TO_MENU;
    case "chooseDoctor":
      return DOCTORS.map((d) => ({ id: d.id, label: d.label }));
    case "chooseDate":
      return (s.dateOptions ?? []).map((d) => ({ id: d.id, label: d.label }));
    case "chooseSlot":
      return SLOTS.map((slot) => ({ id: slot, label: slot }));
    case "confirm":
      return CONFIRM_OPTIONS;
    default:
      return [];
  }
}

function append(s: DemoState, ...msgs: Array<Omit<Message, "id">>): Message[] {
  let id = s.messages.at(-1)?.id ?? 0;
  return [...s.messages, ...msgs.map((m) => ({ ...m, id: ++id }))];
}

function confirmText(s: DemoState): string {
  const doctor = doctorById(s.doctorId!);
  return `Confirm your appointment?\n\n${doctor.label}\n${s.date!.label} (${s.date!.display})\n${s.slot}`;
}

function choose(s: DemoState, optionId: string, now: number): DemoState {
  const option = optionsFor(s).find((o) => o.id === optionId);
  if (!option) return s;

  const base: DemoState = { ...s, startedAt: s.startedAt ?? now };
  const patient = { from: "patient" as const, text: option.label };

  switch (s.state) {
    case "welcome":
      if (option.id === "book") {
        const doctors = DOCTORS.map((d) => `${d.label} — ${d.specialty}`).join("\n");
        return {
          ...base,
          state: "chooseDoctor",
          messages: append(base, patient, { from: "bot", text: `Select a doctor:\n\n${doctors}` }),
        };
      }
      if (option.id === "info") {
        return { ...base, state: "clinicInfo", messages: append(base, patient, { from: "bot", text: CLINIC_INFO_TEXT }) };
      }
      return {
        ...base,
        state: "handoff",
        messages: append(
          base,
          patient,
          { from: "bot", text: "Connecting you to our reception team…" },
          { from: "staff", text: `Hi, this is ${RECEPTIONIST_NAME} from reception 👋\nHow can I help you today?` },
        ),
      };

    case "clinicInfo":
    case "handoff":
      return { ...base, state: "welcome", messages: append(base, patient, { from: "bot", text: MENU_AGAIN_TEXT }) };

    case "chooseDoctor":
      return {
        ...base,
        state: "chooseDate",
        doctorId: option.id as DoctorId,
        dateOptions: dateOptions(new Date(now)),
        messages: append(base, patient, { from: "bot", text: "Select a date:" }),
      };

    case "chooseDate":
      return {
        ...base,
        state: "chooseSlot",
        date: s.dateOptions!.find((d) => d.id === option.id),
        messages: append(base, patient, { from: "bot", text: "Available appointments:" }),
      };

    case "chooseSlot": {
      const next = { ...base, state: "confirm" as const, slot: option.id as Slot };
      return { ...next, messages: append(base, patient, { from: "bot", text: confirmText(next) }) };
    }

    case "confirm":
      if (option.id === "change") {
        return {
          ...base,
          state: "chooseSlot",
          slot: undefined,
          messages: append(base, patient, { from: "bot", text: "Available appointments:" }),
        };
      }
      return {
        ...base,
        state: "booked",
        bookedAt: now,
        messages: append(base, patient, {
          from: "bot",
          text: `✅ Appointment booked successfully.\nAppointment ID: ${DEMO_APPOINTMENT_ID}`,
        }),
      };

    default:
      return s;
  }
}

export function reduce(s: DemoState, event: DemoEvent): DemoState {
  switch (event.type) {
    case "CHOOSE":
      return choose(s, event.option, event.now);
    case "SHOW_DASHBOARD":
      return s.state === "booked" ? { ...s, state: "dashboard" } : s;
    case "COMPLETE":
      return s.state === "dashboard" ? { ...s, state: "conversion", completedAt: event.now } : s;
    case "RESTART":
      return initialState();
  }
}

/** True once the booking exists, i.e. the dashboard should show the new row. */
export function hasBooking(s: DemoState): boolean {
  return s.state === "booked" || s.state === "dashboard" || s.state === "conversion";
}

/** Seconds from first tap to booking confirmation. */
export function secondsToBook(s: DemoState): number | null {
  if (s.startedAt === undefined || s.bookedAt === undefined) return null;
  return Math.max(0, Math.round((s.bookedAt - s.startedAt) / 1000));
}

/** Conversion-screen copy for how long the booking took. */
export function elapsedText(seconds: number | null): string {
  if (seconds === null || seconds < 60) return "That took less than a minute.";
  const minutes = Math.round(seconds / 60);
  return `That took about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

// ---------- sessionStorage (untrusted input) ----------

export const STORAGE_KEY = "cf_demo_v1";
const MAX_MESSAGES = 200;
const MAX_TEXT = 500;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const optNum = (v: unknown) => v === undefined || (typeof v === "number" && Number.isFinite(v));

function isDateOption(v: unknown): v is DateOption {
  return (
    isObj(v) &&
    (v.id === "today" || v.id === "tomorrow" || v.id === "later") &&
    typeof v.label === "string" &&
    v.label.length <= 20 &&
    typeof v.display === "string" &&
    v.display.length <= 30
  );
}

/**
 * Parses a stored demo. Returns null unless the payload is a structurally
 * valid state whose fields are consistent with the state it claims to be in.
 */
export function parseStored(raw: string | null): DemoState | null {
  if (!raw || raw.length > 100_000) return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d) || d.v !== 1 || !STATES.includes(d.state as StateName)) return null;
  if (!Array.isArray(d.messages) || d.messages.length === 0 || d.messages.length > MAX_MESSAGES) return null;
  for (const m of d.messages) {
    if (!isObj(m) || typeof m.id !== "number" || typeof m.text !== "string" || m.text.length > MAX_TEXT) return null;
    if (m.from !== "bot" && m.from !== "patient" && m.from !== "staff") return null;
  }
  if (!optNum(d.startedAt) || !optNum(d.bookedAt) || !optNum(d.completedAt)) return null;
  if (d.doctorId !== undefined && !DOCTORS.some((doc) => doc.id === d.doctorId)) return null;
  if (d.slot !== undefined && !SLOTS.includes(d.slot as Slot)) return null;
  if (d.date !== undefined && !isDateOption(d.date)) return null;
  if (d.dateOptions !== undefined && !(Array.isArray(d.dateOptions) && d.dateOptions.length === 3 && d.dateOptions.every(isDateOption))) {
    return null;
  }

  const state = d.state as StateName;
  const needs = {
    chooseDate: ["doctorId", "dateOptions"],
    chooseSlot: ["doctorId", "date"],
    confirm: ["doctorId", "date", "slot"],
    booked: ["doctorId", "date", "slot", "bookedAt"],
    dashboard: ["doctorId", "date", "slot", "bookedAt"],
    conversion: ["doctorId", "date", "slot", "bookedAt"],
  } as Partial<Record<StateName, string[]>>;
  if ((needs[state] ?? []).some((key) => d[key] === undefined)) return null;

  // Rebuild rather than cast, so unknown keys never flow into state.
  return {
    v: 1,
    state,
    messages: (d.messages as Message[]).map(({ id, from, text }) => ({ id, from, text })),
    doctorId: d.doctorId as DoctorId | undefined,
    dateOptions: d.dateOptions as DateOption[] | undefined,
    date: d.date as DateOption | undefined,
    slot: d.slot as Slot | undefined,
    startedAt: d.startedAt as number | undefined,
    bookedAt: d.bookedAt as number | undefined,
    completedAt: d.completedAt as number | undefined,
  };
}
