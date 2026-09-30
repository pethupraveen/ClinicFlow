import { describe, expect, it } from "vitest";
import { cleanName, MAX_BUTTONS, MAX_LIST_ROWS, step, type BotContext, type BotInput, type BotMessage, type BotPorts, type ConvState } from "./engine";
import { openSlots } from "./slots";

const IST = "Asia/Kolkata";
const now = new Date("2026-09-30T03:30:00Z"); // Wed 09:00 IST

function context(overrides: Partial<BotContext> = {}): BotContext {
  return {
    now,
    timeZone: IST,
    clinic: { name: "Smile Clinic", phone: "+91 98765 43210", address: "1 Main Rd", city: "Chennai", mapsUrl: "" },
    doctors: [
      { id: "d_one", name: "Dr Priya", specialty: "Dentist" },
      { id: "d_two", name: "Dr Arun", specialty: "" },
    ],
    faqs: [{ id: "q_fee", question: "What is the fee?", answer: "₹500" }],
    patientName: null,
    ...overrides,
  };
}

function fakePorts() {
  const booked: { doctorId: string; start: Date; name: string; ref: string }[] = [];
  let takeNext = false;
  const hours = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "10:00", end: "16:00" })); // 12 slots/day at 30 min
  const ports: BotPorts & { booked: typeof booked; failNextBooking(): void; human: number } = {
    booked,
    human: 0,
    failNextBooking: () => (takeNext = true),
    openSlots: async (doctorId) =>
      openSlots({
        hours,
        minutes: 30,
        booked: booked.filter((b) => b.doctorId === doctorId).map((b) => ({ start: b.start, end: new Date(b.start.getTime() + 1_800_000) })),
        now,
        timeZone: IST,
      }),
    book: async ({ doctorId, start, name }) => {
      if (takeNext) {
        takeNext = false;
        return { ok: false };
      }
      const ref = `A-${1001 + booked.length}`;
      booked.push({ doctorId, start, name, ref });
      return { ok: true, ref };
    },
    upcoming: async () => booked.map((b) => ({ ref: b.ref, start: b.start, doctorName: "Dr Priya" })),
    cancel: async (ref) => {
      const i = booked.findIndex((b) => b.ref === ref);
      if (i < 0) return false;
      booked.splice(i, 1);
      return true;
    },
    requestHuman: async () => {
      ports.human++;
    },
  };
  return ports;
}

async function run(inputs: (BotInput | string)[], ctx = context(), ports = fakePorts(), start: ConvState = {}) {
  let state = start;
  let messages: BotMessage[] = [];
  for (const raw of inputs) {
    const input: BotInput = typeof raw === "string" ? (raw.includes(":") || raw === "menu" ? { kind: "choice", id: raw } : { kind: "text", text: raw }) : raw;
    ({ state, messages } = await step(state, input, ctx, ports));
  }
  return { state, messages, ports };
}

function choices(messages: BotMessage[]) {
  return messages.flatMap((m) => (m.kind === "buttons" ? m.buttons : m.kind === "list" ? m.rows : []));
}

describe("bot engine", () => {
  it("greets with the four-option menu on first contact, whatever the patient types", async () => {
    const { messages, state } = await run(["good morning"]);
    expect(state.step).toBe("menu");
    expect(messages[0].text).toContain("Smile Clinic");
    expect(choices(messages).map((c) => c.id)).toEqual(["m:book", "m:mine", "m:info", "m:human"]);
  });

  it("books end to end: doctor → date → time → name → confirm", async () => {
    const ports = fakePorts();
    const { messages, state } = await run(["hi", "m:book", "d:d_one", "day:2026-09-30"], context(), ports);
    expect(state.step).toBe("pick_time");
    const firstTime = choices(messages)[0];
    expect(firstTime.title).toBe("10:00 AM");

    const named = await run([firstTime.id, "Asha Rao"], context(), ports, state);
    expect(named.state.step).toBe("confirm");
    expect(named.messages[0].text).toContain("Asha Rao");
    expect(named.messages[0].text).toContain("Today, 10:00 AM");

    const done = await run(["c:yes"], context(), ports, named.state);
    expect(done.messages[0].text).toContain("Ref: A-1001");
    expect(ports.booked).toHaveLength(1);
    expect(ports.booked[0]).toMatchObject({ doctorId: "d_one", name: "Asha Rao" });
  });

  it("skips the doctor question when there is only one doctor, and the name question for a known patient", async () => {
    const ctx = context({ doctors: [{ id: "d_one", name: "Dr Priya", specialty: "" }], patientName: "Asha" });
    const { state, messages } = await run(["hi", "m:book"], ctx);
    expect(state.step).toBe("pick_date");
    const day = choices(messages)[0].id;
    const t = await run([day], ctx, undefined, state);
    const pick = await run([choices(t.messages)[0].id], ctx, undefined, t.state);
    expect(pick.state.step).toBe("confirm");
    expect(pick.state.name).toBe("Asha");
  });

  it("keeps WhatsApp limits: ≤ 3 buttons, ≤ 10 rows, and pages long time lists", async () => {
    const ports = fakePorts();
    const { messages, state } = await run(["hi", "m:book", "d:d_one", "day:2026-10-01"], context(), ports);
    const rows = choices(messages);
    expect(rows.length).toBeLessThanOrEqual(MAX_LIST_ROWS);
    expect(rows.at(-1)).toMatchObject({ id: "more:1", title: "Later times…" });
    const page2 = await run(["more:1"], context(), ports, state);
    expect(choices(page2.messages).map((c) => c.title)).toEqual(["2:30 PM", "3:00 PM", "3:30 PM", "↩ Other dates"]);
    for (const r of rows) expect(r.title.length).toBeLessThanOrEqual(24);
    const confirm = await run([choices(page2.messages)[0].id, "Asha"], context(), ports, page2.state);
    expect(choices(confirm.messages).length).toBeLessThanOrEqual(MAX_BUTTONS);
  });

  it("rejects a time id that isn't an open slot (stale or forged button)", async () => {
    const { state } = await run(["hi", "m:book", "d:d_one", "day:2026-09-30"]);
    const forged = await run(["t:2026-09-30T20:00:00.000Z"], context(), undefined, state);
    expect(forged.state.step).toBe("pick_time");
    expect(forged.messages[0].text).toMatch(/no longer available/);
  });

  it("offers other times when the slot is taken at confirm", async () => {
    const ports = fakePorts();
    const at = await run(["hi", "m:book", "d:d_one", "day:2026-09-30"], context(), ports);
    const confirm = await run([choices(at.messages)[0].id, "Asha"], context(), ports, at.state);
    ports.failNextBooking();
    const taken = await run(["c:yes"], context(), ports, confirm.state);
    expect(taken.messages[0].text).toMatch(/just taken/);
    expect(taken.state.step).toBe("pick_time");
    expect(ports.booked).toHaveLength(0);
  });

  it("lists and cancels the patient's upcoming appointments", async () => {
    const ports = fakePorts();
    await ports.book({ doctorId: "d_one", start: new Date("2026-10-01T04:30:00Z"), name: "Asha" });
    const list = await run(["hi", "m:mine"], context(), ports);
    expect(choices(list.messages)[0]).toMatchObject({ id: "a:A-1001", title: "Tomorrow, 10:00 AM" });
    const ask = await run(["a:A-1001"], context(), ports, list.state);
    expect(ask.state.step).toBe("confirm_cancel");
    const done = await run(["x:yes"], context(), ports, ask.state);
    expect(done.messages[0].text).toContain("A-1001 is cancelled");
    expect(ports.booked).toHaveLength(0);
  });

  it("answers FAQ questions and hands off to reception", async () => {
    const info = await run(["hi", "m:info"]);
    expect(info.messages[0].text).toContain("1 Main Rd, Chennai");
    const faq = await run(["q:x", "f:q_fee"], context(), undefined, info.state);
    expect(faq.messages.at(-1)?.text).toContain("₹500");

    const ports = fakePorts();
    const human = await run(["hi", "m:human"], context(), ports);
    expect(human.messages[0].text).toContain("+91 98765 43210");
    expect(ports.human).toBe(1);
  });

  it("re-prompts on unexpected text, returns to the menu on 'menu', and resets after 30 idle minutes", async () => {
    const { state } = await run(["hi", "m:book", "d:d_one"]);
    const confused = await run(["tomorrow please"], context(), undefined, state);
    expect(confused.messages[0].text).toMatch(/choose one of the options/);
    expect(confused.state.step).toBe("pick_date");

    expect((await run(["MENU"], context(), undefined, state)).state.step).toBe("menu");

    const later = context({ now: new Date(now.getTime() + 31 * 60_000) });
    const reset = await run(["day:2026-10-01"], later, undefined, state);
    expect(reset.state.step).toBe("menu");
  });

  it("explains when no doctors or no open times exist", async () => {
    const none = await run(["hi", "m:book"], context({ doctors: [] }));
    expect(none.messages[0].text).toMatch(/isn't set up yet/);
    const ports = fakePorts();
    ports.openSlots = async () => [];
    const full = await run(["hi", "m:book", "d:d_one"], context(), ports);
    expect(full.messages[0].text).toMatch(/no open times/);
  });
});

describe("cleanName", () => {
  it("accepts real names and rejects junk", () => {
    expect(cleanName("  Asha   Rao ")).toBe("Asha Rao");
    expect(cleanName("ஆஷா")).toBe("ஆஷா");
    for (const bad of ["a", "12345", "<script>", "x".repeat(61), "asha@mail.com"]) expect(cleanName(bad)).toBeNull();
  });
});
