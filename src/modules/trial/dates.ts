export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";

interface LocalDate {
  year: number;
  month: number; // 1–12
  day: number;
}

/** The calendar date an instant falls on in a time zone. */
export function localDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Offset of a time zone from UTC at an instant, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

/** The instant of local midnight at the start of a calendar date. */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  // Two passes settle the offset even across a DST change.
  let instant = guess - offsetMs(new Date(guess), timeZone);
  instant = guess - offsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function dayNumber(date: LocalDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / 86_400_000;
}

/**
 * Signup day is day 0; the trial ends at local midnight at the start of day
 * `trialDays`. With 15 days, a clinic that signs up on 29 Sep ends at 14 Oct 00:00.
 */
export function trialEndsAt(startedAt: Date, trialDays: number, timeZone: string): Date {
  return startOfLocalDay(addDays(localDate(startedAt, timeZone), trialDays), timeZone);
}

export interface SubscriptionTimes {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
}

/** Status as the product must treat it now, even before the daily job saves an expiry. */
export function effectiveStatus(sub: SubscriptionTimes, now: Date): SubscriptionStatus {
  if (sub.status === "TRIAL" && sub.trialEndsAt && now.getTime() >= sub.trialEndsAt.getTime()) return "EXPIRED";
  return sub.status;
}

export type TrialSummary =
  | { state: "trial"; daysLeft: number; endsOn: string; label: string }
  | { state: "expired"; label: string }
  | { state: "other"; status: SubscriptionStatus };

/**
 * Days left counts calendar days in the clinic's time zone: day 12 of 15 has
 * 3 left, day 14 has 1 ("ends tomorrow"), day 15 has ended.
 */
export function trialSummary(sub: SubscriptionTimes, now: Date, timeZone: string): TrialSummary {
  const status = effectiveStatus(sub, now);
  if (status === "EXPIRED") return { state: "expired", label: "Your free trial has ended" };
  if (status !== "TRIAL" || !sub.trialEndsAt) return { state: "other", status };

  const daysLeft = dayNumber(localDate(sub.trialEndsAt, timeZone)) - dayNumber(localDate(now, timeZone));
  // "Ends 14 Oct" means at 00:00 on 14 Oct, matching the master plan's banner.
  const endsOn = new Intl.DateTimeFormat("en-IN", { timeZone, day: "numeric", month: "short" }).format(sub.trialEndsAt);
  const label = daysLeft === 1 ? "Free trial · ends tomorrow" : `Free trial · ${daysLeft} days left · ends ${endsOn}`;
  return { state: "trial", daysLeft, endsOn, label };
}
