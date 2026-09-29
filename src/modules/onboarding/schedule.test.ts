import { describe, expect, it } from "vitest";
import { parseWeeklyHours, summarizeHours } from "./schedule";

function form(fields: Record<string, string>) {
  return { get: (name: string) => fields[name] ?? null };
}

describe("parseWeeklyHours", () => {
  it("reads ticked days with one or two ranges, sorted", () => {
    const result = parseWeeklyHours(
      form({
        "day-1-on": "on",
        "day-1-1-start": "17:00",
        "day-1-1-end": "20:00",
        "day-1-2-start": "10:00",
        "day-1-2-end": "13:00",
        "day-2-1-start": "10:00", // day 2 not ticked → ignored
        "day-2-1-end": "13:00",
      }),
      15,
    );
    expect(result).toEqual({
      ok: true,
      ranges: [
        { weekday: 1, start: "10:00", end: "13:00" },
        { weekday: 1, start: "17:00", end: "20:00" },
      ],
    });
  });

  it("rejects end before start, too-short ranges and overlaps, per day", () => {
    const result = parseWeeklyHours(
      form({
        "day-1-on": "on",
        "day-1-1-start": "13:00",
        "day-1-1-end": "10:00",
        "day-2-on": "on",
        "day-2-1-start": "10:00",
        "day-2-1-end": "10:10",
        "day-3-on": "on",
        "day-3-1-start": "10:00",
        "day-3-1-end": "13:00",
        "day-3-2-start": "12:00",
        "day-3-2-end": "14:00",
      }),
      15,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toEqual(["1", "2", "3"]);
    expect(result.errors[3]).toMatch(/overlap/);
  });

  it("requires hours on ticked days and valid times", () => {
    const result = parseWeeklyHours(form({ "day-6-on": "on", "day-7-on": "on", "day-7-1-start": "25:00", "day-7-1-end": "26:00" }), 15);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[6]).toMatch(/add working hours/);
    expect(result.errors[7]).toMatch(/start and an end/);
  });

  it("allows back-to-back ranges", () => {
    const result = parseWeeklyHours(
      form({ "day-1-on": "on", "day-1-1-start": "10:00", "day-1-1-end": "13:00", "day-1-2-start": "13:00", "day-1-2-end": "14:00" }),
      30,
    );
    expect(result.ok).toBe(true);
  });
});

describe("summarizeHours", () => {
  it("collapses identical consecutive days", () => {
    const week = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
      { weekday, start: "10:00", end: "13:00" },
      { weekday, start: "17:00", end: "20:00" },
    ]);
    expect(summarizeHours(week)).toBe("Mon–Sat · 10:00–13:00, 17:00–20:00");
    expect(summarizeHours([{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 3, start: "09:00", end: "12:00" }])).toBe("Mon, Wed · 09:00–12:00");
    expect(summarizeHours([])).toBe("No hours set");
  });
});
