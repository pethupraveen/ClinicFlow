import { describe, expect, it } from "vitest";
import { formatDay, formatTime, openSlots } from "./slots";

const IST = "Asia/Kolkata";
// Wed 30 Sep 2026, 09:00 IST
const now = new Date("2026-09-30T03:30:00Z");
const weekdays = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "10:00", end: "12:00" }));

describe("openSlots", () => {
  it("fills weekly hours with appointment-length slots over 7 local days, skipping days off", () => {
    const days = openSlots({ hours: weekdays, minutes: 30, booked: [], now, timeZone: IST });
    // Wed 30 Sep … Tue 6 Oct, minus Sunday 4 Oct
    expect(days.map((d) => d.date)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"]);
    expect(days[0].slots.map((s) => formatTime(s, IST))).toEqual(["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"]);
  });

  it("needs at least an hour's notice", () => {
    const at1030 = new Date("2026-09-30T05:00:00Z"); // 10:30 IST
    const [today] = openSlots({ hours: weekdays, minutes: 30, booked: [], now: at1030, timeZone: IST });
    expect(today.slots.map((s) => formatTime(s, IST))).toEqual(["11:30 AM"]);
  });

  it("drops slots overlapping a booking, including partial overlaps", () => {
    const booked = [{ start: new Date("2026-09-30T04:45:00Z"), end: new Date("2026-09-30T05:15:00Z") }]; // 10:15–10:45 IST
    const [today] = openSlots({ hours: weekdays, minutes: 30, booked, now, timeZone: IST });
    expect(today.slots.map((s) => formatTime(s, IST))).toEqual(["11:00 AM", "11:30 AM"]);
  });

  it("never lets a slot run past the end of a range", () => {
    const [today] = openSlots({ hours: [{ weekday: 3, start: "10:00", end: "10:50" }], minutes: 20, booked: [], now, timeZone: IST });
    expect(today.slots.map((s) => formatTime(s, IST))).toEqual(["10:00 AM", "10:20 AM"]);
  });
});

describe("formatDay", () => {
  it("names today and tomorrow, otherwise weekday and date", () => {
    expect(formatDay("2026-09-30", now, IST)).toBe("Today");
    expect(formatDay("2026-10-01", now, IST)).toBe("Tomorrow");
    expect(formatDay("2026-10-03", now, IST)).toBe("Sat, 3 Oct");
  });
});
