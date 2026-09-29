/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = [
  { day: 1, label: "Monday", short: "Mon" },
  { day: 2, label: "Tuesday", short: "Tue" },
  { day: 3, label: "Wednesday", short: "Wed" },
  { day: 4, label: "Thursday", short: "Thu" },
  { day: 5, label: "Friday", short: "Fri" },
  { day: 6, label: "Saturday", short: "Sat" },
  { day: 7, label: "Sunday", short: "Sun" },
] as const;

export const MAX_RANGES_PER_DAY = 2;
export const APPOINTMENT_LENGTHS = [10, 15, 20, 30] as const;

export interface HoursRange {
  weekday: number;
  start: string; // "HH:MM"
  end: string;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Postgres returns `time` as "HH:MM:SS"; the editor works in "HH:MM". */
export function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

export type ScheduleErrors = Partial<Record<number, string>>;

/**
 * Reads the editor's named inputs (`day-3-on`, `day-3-1-start`, …) and
 * validates each day: valid times, start before end, room for at least one
 * appointment, and no overlapping ranges. Errors are keyed by weekday.
 */
export function parseWeeklyHours(
  form: { get(name: string): FormDataEntryValue | null },
  appointmentMinutes: number,
): { ok: true; ranges: HoursRange[] } | { ok: false; errors: ScheduleErrors } {
  const ranges: HoursRange[] = [];
  const errors: ScheduleErrors = {};
  const str = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };

  for (const { day, label } of WEEKDAYS) {
    if (str(`day-${day}-on`) !== "on") continue;
    const dayRanges: HoursRange[] = [];
    for (let r = 1; r <= MAX_RANGES_PER_DAY; r++) {
      const start = str(`day-${day}-${r}-start`);
      const end = str(`day-${day}-${r}-end`);
      if (!start && !end) continue;
      if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
        errors[day] = `${label}: enter both a start and an end time.`;
        break;
      }
      if (toMinutes(end) - toMinutes(start) < appointmentMinutes) {
        errors[day] = `${label}: each time range must end after it starts and fit at least one ${appointmentMinutes}-minute appointment.`;
        break;
      }
      dayRanges.push({ weekday: day, start, end });
    }
    if (errors[day]) continue;
    if (dayRanges.length === 0) {
      errors[day] = `${label}: add working hours, or untick the day.`;
      continue;
    }
    dayRanges.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    if (dayRanges.length === 2 && toMinutes(dayRanges[1].start) < toMinutes(dayRanges[0].end)) {
      errors[day] = `${label}: the two time ranges overlap.`;
      continue;
    }
    ranges.push(...dayRanges);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, ranges };
}

/** Human summary for the doctor list, e.g. "Mon–Sat · 10:00–13:00, 17:00–20:00". */
export function summarizeHours(ranges: HoursRange[]): string {
  if (ranges.length === 0) return "No hours set";
  const days = [...new Set(ranges.map((r) => r.weekday))].sort((a, b) => a - b);
  const byDay = (day: number) => ranges.filter((r) => r.weekday === day).map((r) => `${r.start}–${r.end}`).join(", ");
  const same = days.every((d) => byDay(d) === byDay(days[0]));
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const name = (d: number) => WEEKDAYS[d - 1].short;
  const dayLabel = days.length > 1 && contiguous ? `${name(days[0])}–${name(days[days.length - 1])}` : days.map(name).join(", ");
  return same ? `${dayLabel} · ${byDay(days[0])}` : `${days.length} days a week`;
}
