import { describe, expect, it } from "vitest";
import { dateOptions } from "./dates";
import { DEMO_APPOINTMENT_ID, dashboardAppointments, type DoctorId, type Slot } from "./fixtures";
import {
  elapsedText,
  hasBooking,
  initialState,
  optionsFor,
  parseStored,
  reduce,
  secondsToBook,
  type DemoEvent,
  type DemoState,
} from "./machine";

// Thursday 24 Sep 2026, 10:00 local time.
const T0 = new Date(2026, 8, 24, 10, 0, 0).getTime();

function run(...steps: Array<string | DemoEvent>): DemoState {
  let now = T0;
  return steps.reduce<DemoState>((s, step) => {
    now += 5_000;
    const event: DemoEvent = typeof step === "string" ? { type: "CHOOSE", option: step, now } : step;
    return reduce(s, event);
  }, initialState());
}

const HAPPY_PATH = ["book", "arun", "tomorrow", "10:30 AM", "confirm"];

describe("demo state machine", () => {
  it("starts at Welcome with the three menu options", () => {
    const s = initialState();
    expect(s.state).toBe("welcome");
    expect(s.messages[0].text).toContain("Welcome to SmileCare Dental Clinic");
    expect(optionsFor(s).map((o) => o.label)).toEqual(["Book Appointment", "Clinic Information", "Talk to Reception"]);
  });

  it("walks the booking path Welcome → ChooseDoctor → ChooseDate → ChooseSlot → Confirm → Booked", () => {
    const states = HAPPY_PATH.map((_, i) => run(...HAPPY_PATH.slice(0, i + 1)).state);
    expect(states).toEqual(["chooseDoctor", "chooseDate", "chooseSlot", "confirm", "booked"]);

    const s = run(...HAPPY_PATH);
    expect(s).toMatchObject({ doctorId: "arun", slot: "10:30 AM", date: { id: "tomorrow", label: "Tomorrow" } });
    expect(s.messages.at(-1)!.text).toBe(`✅ Appointment booked successfully.\nAppointment ID: ${DEMO_APPOINTMENT_ID}`);
    expect(DEMO_APPOINTMENT_ID.startsWith("DEMO-")).toBe(true);
  });

  it("offers the specified options at each step", () => {
    expect(optionsFor(run("book")).map((o) => o.label)).toEqual(["Dr. Arun", "Dr. Priya"]);
    expect(optionsFor(run("book", "arun")).map((o) => o.label)).toEqual(["Today", "Tomorrow", "Saturday"]);
    expect(optionsFor(run("book", "arun", "today")).map((o) => o.label)).toEqual(["10:00 AM", "10:30 AM", "11:00 AM"]);
    expect(optionsFor(run("book", "arun", "today", "10:00 AM")).map((o) => o.label)).toEqual(["Confirm", "Change time"]);
    expect(optionsFor(run(...HAPPY_PATH))).toEqual([]);
  });

  it("shows doctor, date and time on the confirm step", () => {
    const text = run("book", "priya", "tomorrow", "11:00 AM").messages.at(-1)!.text;
    expect(text).toMatch(/^Confirm your appointment\?/);
    expect(text).toContain("Dr. Priya");
    expect(text).toContain("Tomorrow");
    expect(text).toContain("11:00 AM");
  });

  it("echoes each tapped option as a patient message", () => {
    const patient = run(...HAPPY_PATH).messages.filter((m) => m.from === "patient").map((m) => m.text);
    expect(patient).toEqual(["Book Appointment", "Dr. Arun", "Tomorrow", "10:30 AM", "Confirm"]);
  });

  it("Change time returns to ChooseSlot and clears the slot", () => {
    const s = run("book", "arun", "tomorrow", "10:30 AM", "change");
    expect(s.state).toBe("chooseSlot");
    expect(s.slot).toBeUndefined();
    expect(run("book", "arun", "tomorrow", "10:30 AM", "change", "11:00 AM", "confirm").slot).toBe("11:00 AM");
  });

  it("Clinic Information and Talk to Reception both return to the menu", () => {
    const info = run("info");
    expect(info.state).toBe("clinicInfo");
    expect(info.messages.at(-1)!.text).toMatch(/Timings[\s\S]*Address[\s\S]*fees[\s\S]*Google Maps/);
    expect(run("info", "menu").state).toBe("welcome");

    const handoff = run("reception");
    expect(handoff.state).toBe("handoff");
    expect(handoff.messages.slice(-2).map((m) => m.from)).toEqual(["bot", "staff"]);
    expect(run("reception", "menu").state).toBe("welcome");
    expect(run("reception", "menu", ...HAPPY_PATH).state).toBe("booked");
  });

  it("Booked → Dashboard → Conversion, and nowhere else", () => {
    const booked = run(...HAPPY_PATH);
    expect(reduce(initialState(), { type: "SHOW_DASHBOARD" }).state).toBe("welcome");
    expect(reduce(booked, { type: "COMPLETE", now: T0 }).state).toBe("booked");

    const dash = reduce(booked, { type: "SHOW_DASHBOARD" });
    expect(dash.state).toBe("dashboard");
    const done = reduce(dash, { type: "COMPLETE", now: T0 + 60_000 });
    expect(done.state).toBe("conversion");
    expect(done.completedAt).toBe(T0 + 60_000);
  });

  it("ignores options that the current state does not offer", () => {
    const s = run("book");
    expect(reduce(s, { type: "CHOOSE", option: "confirm", now: T0 })).toBe(s);
    expect(reduce(s, { type: "CHOOSE", option: "10:30 AM", now: T0 })).toBe(s);
    expect(reduce(s, { type: "CHOOSE", option: "__proto__", now: T0 })).toBe(s);
  });

  it("RESTART returns to Welcome from any state", () => {
    const done = reduce(reduce(run(...HAPPY_PATH), { type: "SHOW_DASHBOARD" }), { type: "COMPLETE", now: T0 });
    expect(reduce(done, { type: "RESTART" })).toEqual(initialState());
  });

  it("measures time from first tap to booking", () => {
    // 5 taps, 5s apart: first tap at +5s, confirm at +25s.
    expect(secondsToBook(run(...HAPPY_PATH))).toBe(20);
    expect(secondsToBook(initialState())).toBeNull();
    expect(hasBooking(run(...HAPPY_PATH))).toBe(true);
    expect(hasBooking(run("book", "arun"))).toBe(false);
  });
});

describe("dateOptions", () => {
  const labels = (y: number, m: number, d: number) => dateOptions(new Date(y, m, d, 12)).map((o) => o.label);

  it.each([
    ["Sunday", 27, "Friday"],
    ["Monday", 28, "Friday"],
    ["Tuesday", 29, "Friday"],
    ["Wednesday", 30, "Friday"],
  ])("on %s the third chip is Friday", (_day, date, third) => {
    expect(labels(2026, 8, date)).toEqual(["Today", "Tomorrow", third]);
  });

  it("on Thursday (Friday is tomorrow) the third chip is Saturday", () => {
    expect(labels(2026, 8, 24)).toEqual(["Today", "Tomorrow", "Saturday"]);
  });

  it("on Friday the third chip skips Sunday to Monday", () => {
    expect(labels(2026, 8, 25)).toEqual(["Today", "Tomorrow", "Monday"]);
  });

  it("on Saturday the third chip is the coming Friday", () => {
    expect(labels(2026, 8, 26)).toEqual(["Today", "Tomorrow", "Friday"]);
  });

  it("crosses month boundaries", () => {
    expect(dateOptions(new Date(2026, 8, 30, 23, 59))[1].display).toMatch(/1 Oct/);
  });
});

describe("dashboardAppointments", () => {
  it("adds the demo booking as the highlighted row, in time order", () => {
    const rows = dashboardAppointments({ doctorId: "arun", slot: "10:30 AM" });
    expect(rows.map((r) => `${r.time} ${r.patient}`)).toEqual([
      "9:30 AM Patient C",
      "10:00 AM Patient A",
      "10:30 AM Demo Patient",
      "11:00 AM Patient B",
    ]);
    expect(rows.filter((r) => r.isNew)).toHaveLength(1);
  });

  it("never double-books the chosen doctor", () => {
    for (const doctorId of ["arun", "priya"] as DoctorId[]) {
      for (const slot of ["10:00 AM", "10:30 AM", "11:00 AM"] as Slot[]) {
        const rows = dashboardAppointments({ doctorId, slot });
        const keys = rows.map((r) => `${r.doctor}@${r.time}`);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it("has no demo row before booking", () => {
    expect(dashboardAppointments(null).some((r) => r.isNew)).toBe(false);
  });
});

describe("parseStored", () => {
  const booked = run(...HAPPY_PATH);

  it("round-trips a valid state", () => {
    expect(parseStored(JSON.stringify(booked))).toEqual(booked);
  });

  it("drops unknown keys", () => {
    const parsed = parseStored(JSON.stringify({ ...booked, isAdmin: true, businessId: "x" }));
    expect(parsed).not.toHaveProperty("isAdmin");
    expect(parsed).not.toHaveProperty("businessId");
  });

  it.each([
    ["null", null],
    ["not JSON", "{"],
    ["wrong version", JSON.stringify({ ...booked, v: 2 })],
    ["unknown state", JSON.stringify({ ...booked, state: "admin" })],
    ["no messages", JSON.stringify({ ...booked, messages: [] })],
    ["bad sender", JSON.stringify({ ...booked, messages: [{ id: 1, from: "system", text: "x" }] })],
    ["oversized text", JSON.stringify({ ...booked, messages: [{ id: 1, from: "bot", text: "x".repeat(600) }] })],
    ["unknown doctor", JSON.stringify({ ...booked, doctorId: "mallory" })],
    ["unknown slot", JSON.stringify({ ...booked, slot: "3:00 AM" })],
    ["booked without a slot", JSON.stringify({ ...booked, slot: undefined })],
    ["jump straight to conversion", JSON.stringify({ v: 1, state: "conversion", messages: booked.messages })],
  ])("rejects %s", (_name, raw) => {
    expect(parseStored(raw)).toBeNull();
  });
});

describe("elapsedText", () => {
  it("says less than a minute under 60s, otherwise rounds to minutes", () => {
    expect(elapsedText(null)).toBe("That took less than a minute.");
    expect(elapsedText(42)).toBe("That took less than a minute.");
    expect(elapsedText(75)).toBe("That took about 1 minute.");
    expect(elapsedText(200)).toBe("That took about 3 minutes.");
  });
});
