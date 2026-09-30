import { formatDay, formatTime, type DaySlots } from "./slots";

// ---------- message shapes (WhatsApp interactive-message limits) ----------

export const MAX_BUTTONS = 3;
export const MAX_LIST_ROWS = 10;
const BUTTON_TITLE_MAX = 20;
const ROW_TITLE_MAX = 24;
const ROW_DESCRIPTION_MAX = 72;

export interface Choice {
  id: string;
  title: string;
  description?: string;
}

export type BotMessage =
  | { kind: "text"; text: string }
  | { kind: "buttons"; text: string; buttons: Choice[] }
  | { kind: "list"; text: string; button: string; rows: Choice[] };

export type BotInput = { kind: "text"; text: string } | { kind: "choice"; id: string };

// ---------- state ----------

export type Step = "menu" | "pick_doctor" | "pick_date" | "pick_time" | "ask_name" | "confirm" | "my_appts" | "confirm_cancel" | "info";

export interface ConvState {
  step?: Step;
  doctor?: string;
  date?: string;
  slot?: string; // ISO instant
  page?: number;
  name?: string;
  appt?: string; // appointment ref being cancelled
  updatedAt?: string;
}

export const IDLE_RESET_MINUTES = 30;
const RESET_WORDS = new Set(["hi", "hello", "hey", "menu", "0", "start", "restart", "home"]);
const TIMES_PER_PAGE = 9;

// ---------- context and ports ----------

export interface BotDoctor {
  id: string;
  name: string;
  specialty: string;
}

export interface BotContext {
  now: Date;
  timeZone: string;
  clinic: { name: string; phone: string; address: string; city: string; mapsUrl: string };
  doctors: BotDoctor[];
  faqs: { id: string; question: string; answer: string }[];
  patientName: string | null;
}

export interface UpcomingAppointment {
  ref: string;
  start: Date;
  doctorName: string;
}

export interface BotPorts {
  openSlots(doctorId: string): Promise<DaySlots[]>;
  book(input: { doctorId: string; start: Date; name: string }): Promise<{ ok: true; ref: string } | { ok: false }>;
  upcoming(): Promise<UpcomingAppointment[]>;
  cancel(ref: string): Promise<boolean>;
  requestHuman(): Promise<void>;
}

export interface StepResult {
  state: ConvState;
  messages: BotMessage[];
}

// ---------- helpers ----------

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function button(id: string, title: string): Choice {
  return { id, title: clip(title, BUTTON_TITLE_MAX) };
}

function row(id: string, title: string, description?: string): Choice {
  return { id, title: clip(title, ROW_TITLE_MAX), ...(description ? { description: clip(description, ROW_DESCRIPTION_MAX) } : {}) };
}

const MENU_BUTTON = button("menu", "Main menu");

function when(ctx: BotContext, start: Date): string {
  const day = formatDay(dateOf(start, ctx.timeZone), ctx.now, ctx.timeZone);
  return `${day}, ${formatTime(start, ctx.timeZone)}`;
}

function dateOf(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function doctorLabel(d: BotDoctor): string {
  return d.specialty ? `${d.name} (${d.specialty})` : d.name;
}

// ---------- prompts ----------

function menu(ctx: BotContext, greeting = true): StepResult {
  return {
    state: { step: "menu" },
    messages: [
      {
        kind: "list",
        text: greeting ? `👋 Welcome to ${ctx.clinic.name}. How can we help you today?` : "What would you like to do next?",
        button: "Choose",
        rows: [
          row("m:book", "📅 Book appointment"),
          row("m:mine", "🗂 My appointments"),
          row("m:info", "ℹ️ Clinic info & FAQ"),
          row("m:human", "🙋 Talk to reception"),
        ],
      },
    ],
  };
}

function doctors(ctx: BotContext): StepResult {
  if (ctx.doctors.length === 0) {
    return {
      state: { step: "menu" },
      messages: [
        { kind: "buttons", text: `Online booking isn't set up yet. Please call ${ctx.clinic.phone} to book.`, buttons: [MENU_BUTTON] },
      ],
    };
  }
  if (ctx.doctors.length === 1) return { state: { step: "pick_doctor" }, messages: [] };
  return {
    state: { step: "pick_doctor" },
    messages: [
      {
        kind: "list",
        text: "Which doctor would you like to see?",
        button: "Choose doctor",
        rows: [...ctx.doctors.slice(0, MAX_LIST_ROWS - 1).map((d) => row(`d:${d.id}`, d.name, d.specialty)), row("menu", "↩ Main menu")],
      },
    ],
  };
}

async function dates(ctx: BotContext, ports: BotPorts, doctorId: string): Promise<StepResult> {
  const doctor = ctx.doctors.find((d) => d.id === doctorId)!;
  const days = await ports.openSlots(doctorId);
  if (days.length === 0) {
    return {
      state: { step: "menu" },
      messages: [
        {
          kind: "buttons",
          text: `Sorry, ${doctor.name} has no open times in the next 7 days. Please call ${ctx.clinic.phone}.`,
          buttons: ctx.doctors.length > 1 ? [button("m:book", "Other doctors"), MENU_BUTTON] : [MENU_BUTTON],
        },
      ],
    };
  }
  return {
    state: { step: "pick_date", doctor: doctorId },
    messages: [
      {
        kind: "list",
        text: `When would you like to see ${doctorLabel(doctor)}?`,
        button: "Choose date",
        rows: [
          ...days.slice(0, MAX_LIST_ROWS - 1).map((d) =>
            row(`day:${d.date}`, formatDay(d.date, ctx.now, ctx.timeZone), `${d.slots.length} time${d.slots.length === 1 ? "" : "s"} available`),
          ),
          row("menu", "↩ Main menu"),
        ],
      },
    ],
  };
}

async function times(ctx: BotContext, ports: BotPorts, doctorId: string, date: string, page: number, lead?: string): Promise<StepResult> {
  const day = (await ports.openSlots(doctorId)).find((d) => d.date === date);
  if (!day) return withLead(await dates(ctx, ports, doctorId), "Sorry, that day is now fully booked.");
  const start = page * TIMES_PER_PAGE;
  const pageSlots = day.slots.slice(start, start + TIMES_PER_PAGE);
  const hasMore = day.slots.length > start + TIMES_PER_PAGE;
  const rows = pageSlots.map((s) => row(`t:${s.toISOString()}`, formatTime(s, ctx.timeZone)));
  rows.push(hasMore ? row(`more:${page + 1}`, "Later times…") : row("back:dates", "↩ Other dates"));
  const result: StepResult = {
    state: { step: "pick_time", doctor: doctorId, date, page },
    messages: [{ kind: "list", text: `Available times on ${formatDay(date, ctx.now, ctx.timeZone)}:`, button: "Choose time", rows }],
  };
  return lead ? withLead(result, lead) : result;
}

function confirm(ctx: BotContext, state: ConvState): StepResult {
  const doctor = ctx.doctors.find((d) => d.id === state.doctor)!;
  return {
    state: { ...state, step: "confirm" },
    messages: [
      {
        kind: "buttons",
        text: `Please confirm your appointment:\n👤 ${state.name}\n🩺 ${doctorLabel(doctor)}\n🕒 ${when(ctx, new Date(state.slot!))}`,
        buttons: [button("c:yes", "✅ Confirm"), button("c:change", "Change time"), button("menu", "Cancel")],
      },
    ],
  };
}

async function mine(ctx: BotContext, ports: BotPorts): Promise<StepResult> {
  const list = await ports.upcoming();
  if (list.length === 0) {
    return {
      state: { step: "menu" },
      messages: [{ kind: "buttons", text: "You have no upcoming appointments.", buttons: [button("m:book", "Book appointment"), MENU_BUTTON] }],
    };
  }
  return {
    state: { step: "my_appts" },
    messages: [
      {
        kind: "list",
        text: "Your upcoming appointments. Choose one to cancel it:",
        button: "My appointments",
        rows: [...list.slice(0, MAX_LIST_ROWS - 1).map((a) => row(`a:${a.ref}`, when(ctx, a.start), `${a.ref} · ${a.doctorName}`)), row("menu", "↩ Main menu")],
      },
    ],
  };
}

function info(ctx: BotContext): StepResult {
  const c = ctx.clinic;
  const lines = [`🏥 ${c.name}`, c.address && `📍 ${c.address}${c.city ? `, ${c.city}` : ""}`, c.phone && `📞 ${c.phone}`, c.mapsUrl && `🗺 ${c.mapsUrl}`].filter(Boolean);
  const messages: BotMessage[] = [{ kind: "text", text: lines.join("\n") }];
  if (ctx.faqs.length > 0) {
    messages.push({
      kind: "list",
      text: "Common questions:",
      button: "See questions",
      rows: [...ctx.faqs.slice(0, MAX_LIST_ROWS - 1).map((f) => row(`f:${f.id}`, f.question)), row("menu", "↩ Main menu")],
    });
  } else {
    messages.push({ kind: "buttons", text: "Anything else?", buttons: [button("m:book", "Book appointment"), MENU_BUTTON] });
  }
  return { state: { step: "info" }, messages };
}

function withLead(result: StepResult, text: string): StepResult {
  return { ...result, messages: [{ kind: "text", text }, ...result.messages] };
}

/** Re-sends the prompt for the current step, e.g. after unexpected text. */
async function reprompt(state: ConvState, ctx: BotContext, ports: BotPorts): Promise<StepResult> {
  switch (state.step) {
    case "pick_doctor":
      return doctors(ctx);
    case "pick_date":
      return dates(ctx, ports, state.doctor!);
    case "pick_time":
      return times(ctx, ports, state.doctor!, state.date!, state.page ?? 0);
    case "ask_name":
      return { state, messages: [{ kind: "text", text: "What's the patient's full name?" }] };
    case "confirm":
      return confirm(ctx, state);
    case "my_appts":
      return mine(ctx, ports);
    case "info":
      return info(ctx);
    default:
      return menu(ctx, false);
  }
}

async function startBooking(ctx: BotContext, ports: BotPorts): Promise<StepResult> {
  const picked = doctors(ctx);
  if (picked.state.step === "pick_doctor" && ctx.doctors.length === 1) return dates(ctx, ports, ctx.doctors[0].id);
  return picked;
}

// ---------- the state machine ----------

function isStale(state: ConvState, now: Date): boolean {
  if (!state.updatedAt) return true;
  return now.getTime() - Date.parse(state.updatedAt) > IDLE_RESET_MINUTES * 60_000;
}

export function cleanName(text: string): string | null {
  const name = text.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) return null;
  if (!/\p{L}/u.test(name) || /[<>{}@#$%^*=_|\\/0-9]/.test(name)) return null;
  return name;
}

/**
 * One patient message in, the bot's replies out. Pure apart from the ports,
 * so the same logic serves the in-app test chat and WhatsApp.
 */
export async function step(prev: ConvState, input: BotInput, ctx: BotContext, ports: BotPorts): Promise<StepResult> {
  const state: ConvState = isStale(prev, ctx.now) ? {} : prev;
  const result = await transition(state, input, ctx, ports);
  return { ...result, state: { ...result.state, updatedAt: ctx.now.toISOString() } };
}

async function transition(state: ConvState, input: BotInput, ctx: BotContext, ports: BotPorts): Promise<StepResult> {
  if (!state.step) return menu(ctx);
  if (input.kind === "text" && RESET_WORDS.has(input.text.trim().toLowerCase())) return menu(ctx);

  // Free text is only meaningful when we asked for a name.
  if (input.kind === "text") {
    if (state.step === "ask_name") {
      const name = cleanName(input.text);
      if (!name) return { state, messages: [{ kind: "text", text: "Please type the patient's full name (letters only)." }] };
      return confirm(ctx, { ...state, name });
    }
    return withLead(await reprompt(state, ctx, ports), "Please choose one of the options below.");
  }

  const id = input.id;
  if (id === "menu") return menu(ctx, false);

  switch (state.step) {
    case "menu":
      if (id === "m:book") return startBooking(ctx, ports);
      if (id === "m:mine") return mine(ctx, ports);
      if (id === "m:info") return info(ctx);
      if (id === "m:human") {
        await ports.requestHuman();
        return {
          state: { step: "menu" },
          messages: [
            {
              kind: "buttons",
              text: `A receptionist will get back to you here soon. For anything urgent, please call ${ctx.clinic.phone}.`,
              buttons: [MENU_BUTTON],
            },
          ],
        };
      }
      break;
    case "pick_doctor":
      if (id.startsWith("d:") && ctx.doctors.some((d) => d.id === id.slice(2))) return dates(ctx, ports, id.slice(2));
      break;
    case "pick_date":
      if (id.startsWith("day:")) return times(ctx, ports, state.doctor!, id.slice(4), 0);
      break;
    case "pick_time": {
      if (id === "back:dates") return dates(ctx, ports, state.doctor!);
      if (id.startsWith("more:")) return times(ctx, ports, state.doctor!, state.date!, Number(id.slice(5)) || 0);
      if (id.startsWith("t:")) {
        // Only accept a time that is actually open right now.
        const iso = id.slice(2);
        const open = (await ports.openSlots(state.doctor!)).some((d) => d.slots.some((s) => s.toISOString() === iso));
        if (!open) return times(ctx, ports, state.doctor!, state.date!, 0, "Sorry, that time is no longer available.");
        const next: ConvState = { ...state, slot: iso };
        if (ctx.patientName) return confirm(ctx, { ...next, name: ctx.patientName });
        return { state: { ...next, step: "ask_name" }, messages: [{ kind: "text", text: "Great! What's the patient's full name?" }] };
      }
      break;
    }
    case "confirm":
      if (id === "c:change") return times(ctx, ports, state.doctor!, state.date!, 0);
      if (id === "c:yes") {
        const start = new Date(state.slot!);
        const stillOpen = (await ports.openSlots(state.doctor!)).some((d) => d.slots.some((s) => s.getTime() === start.getTime()));
        const booked = stillOpen ? await ports.book({ doctorId: state.doctor!, start, name: state.name! }) : { ok: false as const };
        if (!booked.ok) return times(ctx, ports, state.doctor!, state.date!, 0, "Sorry, that time was just taken. Please pick another.");
        const doctor = ctx.doctors.find((d) => d.id === state.doctor)!;
        const where = [ctx.clinic.address, ctx.clinic.city].filter(Boolean).join(", ");
        return {
          state: { step: "menu" },
          messages: [
            {
              kind: "buttons",
              text: `✅ Appointment booked!\nRef: ${booked.ref}\n🩺 ${doctorLabel(doctor)}\n🕒 ${when(ctx, start)}${where ? `\n📍 ${where}` : ""}\n\nTo cancel, open "My appointments" from the menu.`,
              buttons: [MENU_BUTTON],
            },
          ],
        };
      }
      break;
    case "my_appts":
      if (id.startsWith("a:")) {
        const ref = id.slice(2);
        const appt = (await ports.upcoming()).find((a) => a.ref === ref);
        if (!appt) return withLead(await mine(ctx, ports), "That appointment isn't upcoming any more.");
        return {
          state: { step: "confirm_cancel", appt: ref },
          messages: [
            {
              kind: "buttons",
              text: `Cancel appointment ${ref} with ${appt.doctorName} on ${when(ctx, appt.start)}?`,
              buttons: [button("x:yes", "Yes, cancel it"), button("x:no", "No, keep it")],
            },
          ],
        };
      }
      break;
    case "confirm_cancel":
      if (id === "x:no") return withLead(menu(ctx, false), "No problem, your appointment is kept.");
      if (id === "x:yes") {
        const ok = await ports.cancel(state.appt!);
        return withLead(menu(ctx, false), ok ? `Your appointment ${state.appt} is cancelled.` : "That appointment was already cancelled or has passed.");
      }
      break;
    case "info":
      if (id === "m:book") return startBooking(ctx, ports);
      if (id.startsWith("f:")) {
        const faq = ctx.faqs.find((f) => f.id === id.slice(2));
        if (faq) {
          return {
            state: { step: "info" },
            messages: [{ kind: "buttons", text: `*${faq.question}*\n${faq.answer}`, buttons: [button("m:info", "More questions"), MENU_BUTTON] }],
          };
        }
      }
      if (id === "m:info") return info(ctx);
      break;
  }
  // A stale or unknown button: show where we are again.
  return withLead(await reprompt(state, ctx, ports), "Please choose one of the options below.");
}
