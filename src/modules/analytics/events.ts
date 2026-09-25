/** Event definitions shared by API validators and browser instrumentation. */
export const DEMO_EVENT_NAMES = [
  "demo_booking_started",
  "demo_booking_confirmed",
  "demo_dashboard_viewed",
  "demo_completed",
  "demo_restarted",
  "demo_trial_cta_clicked",
  "demo_book_demo_cta_clicked",
] as const;

export type DemoEventName = (typeof DEMO_EVENT_NAMES)[number];

export const MARKETING_PAGES = ["landing", "demo"] as const;
export type MarketingPage = (typeof MARKETING_PAGES)[number];

const DEMO_EVENT_SET = new Set<string>(DEMO_EVENT_NAMES);
const MARKETING_PAGE_SET = new Set<string>(MARKETING_PAGES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Only a fixed event name may cross the public API boundary. */
export function parseDemoEvents(value: unknown): DemoEventName[] | null {
  if (!isRecord(value) || !Array.isArray(value.events) || value.events.length === 0 || value.events.length > 20) {
    return null;
  }

  const names: DemoEventName[] = [];
  for (const event of value.events) {
    if (!isRecord(event) || Object.keys(event).length !== 1 || typeof event.name !== "string" || !DEMO_EVENT_SET.has(event.name)) {
      return null;
    }
    names.push(event.name as DemoEventName);
  }
  return names;
}

/** Marketing collection accepts no title, URL, referrer, query parameter or other free-form data. */
export function parseMarketingPageView(value: unknown): MarketingPage | null {
  if (!isRecord(value) || Object.keys(value).length !== 2 || value.name !== "marketing_page_viewed") return null;
  return typeof value.page === "string" && MARKETING_PAGE_SET.has(value.page) ? (value.page as MarketingPage) : null;
}
