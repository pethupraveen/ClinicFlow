"use client";

import type { DemoEventName, MarketingPage } from "./events";

async function post(path: string, payload: unknown): Promise<boolean> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return response.ok;
  } catch {
    // Analytics must never affect the public demo or marketing experience.
    return false;
  }
}

export function startDemoAnalyticsSession(): Promise<boolean> {
  return post("/api/demo/sessions", {});
}

export function trackDemoEvent(name: DemoEventName): Promise<boolean> {
  return post("/api/demo/events", { events: [{ name }] });
}

export function trackMarketingPageView(page: MarketingPage): Promise<boolean> {
  return post("/api/public/events", { name: "marketing_page_viewed", page });
}
