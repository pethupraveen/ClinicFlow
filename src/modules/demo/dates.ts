export interface DateOption {
  id: "today" | "tomorrow" | "later";
  /** Button label: "Today", "Tomorrow", or a weekday name such as "Friday". */
  label: string;
  /** Long form for confirmations, e.g. "Thu, 24 Sep". */
  display: string;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FRIDAY = 5;
const SUNDAY = 0;

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function display(date: Date): string {
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Today, Tomorrow, and a third chip computed from the visitor's local date.
 * The third chip is the coming Friday when it is at least two days away;
 * otherwise (Thursday, Friday) it is the day after tomorrow, skipping Sunday.
 */
export function dateOptions(now: Date): DateOption[] {
  const today = addDays(now, 0);
  const daysToFriday = (FRIDAY - today.getDay() + 7) % 7;
  let offset = daysToFriday >= 2 ? daysToFriday : 2;
  if (addDays(today, offset).getDay() === SUNDAY) offset += 1;
  const later = addDays(today, offset);

  return [
    { id: "today", label: "Today", display: display(today) },
    { id: "tomorrow", label: "Tomorrow", display: display(addDays(today, 1)) },
    { id: "later", label: WEEKDAYS[later.getDay()], display: display(later) },
  ];
}
