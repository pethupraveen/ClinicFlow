import { toMinutes, type HoursRange } from "@/modules/onboarding/schedule";
import { localDate, startOfLocalDay } from "@/modules/trial/dates";

export const BOOKING_HORIZON_DAYS = 7;
export const BOOKING_NOTICE_MINUTES = 60;

export interface Interval {
  start: Date;
  end: Date;
}

export interface DaySlots {
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  slots: Date[];
}

function isoWeekday(date: { year: number; month: number; day: number }): number {
  const dow = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay(); // 0 = Sunday
  return dow === 0 ? 7 : dow;
}

function addDays(date: { year: number; month: number; day: number }, days: number) {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function dateKey(date: { year: number; month: number; day: number }): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/**
 * Open appointment starts for one doctor: every `minutes`-long slot inside
 * their weekly hours, over today and the next 6 local days, starting at least
 * an hour from now, minus anything overlapping an existing booking.
 */
export function openSlots(input: {
  hours: HoursRange[];
  minutes: number;
  booked: Interval[];
  now: Date;
  timeZone: string;
  horizonDays?: number;
  noticeMinutes?: number;
}): DaySlots[] {
  const horizon = input.horizonDays ?? BOOKING_HORIZON_DAYS;
  const earliest = input.now.getTime() + (input.noticeMinutes ?? BOOKING_NOTICE_MINUTES) * 60_000;
  const today = localDate(input.now, input.timeZone);
  const days: DaySlots[] = [];

  for (let offset = 0; offset < horizon; offset++) {
    const date = addDays(today, offset);
    const weekday = isoWeekday(date);
    const midnight = startOfLocalDay(date, input.timeZone).getTime();
    const slots: Date[] = [];
    for (const range of input.hours.filter((h) => h.weekday === weekday)) {
      const end = toMinutes(range.end);
      for (let m = toMinutes(range.start); m + input.minutes <= end; m += input.minutes) {
        const start = midnight + m * 60_000;
        const finish = start + input.minutes * 60_000;
        if (start < earliest) continue;
        const clash = input.booked.some((b) => start < b.end.getTime() && b.start.getTime() < finish);
        if (!clash) slots.push(new Date(start));
      }
    }
    slots.sort((a, b) => a.getTime() - b.getTime());
    if (slots.length > 0) days.push({ date: dateKey(date), slots });
  }
  return days;
}

export function formatTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(instant)
    .toUpperCase();
}

/** "Today", "Tomorrow", or e.g. "Fri, 3 Oct". */
export function formatDay(key: string, now: Date, timeZone: string): string {
  const today = dateKey(localDate(now, timeZone));
  const tomorrow = dateKey(addDays(localDate(now, timeZone), 1));
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
