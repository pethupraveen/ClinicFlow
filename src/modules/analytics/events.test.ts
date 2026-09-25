import { describe, expect, it } from "vitest";
import { parseDemoEvents, parseMarketingPageView } from "./events";

describe("analytics event validation", () => {
  it("allows a bounded batch of known demo event names", () => {
    expect(parseDemoEvents({ events: [{ name: "demo_booking_confirmed" }, { name: "demo_completed" }] })).toEqual([
      "demo_booking_confirmed",
      "demo_completed",
    ]);
  });

  it("rejects unrecognised events and free-form properties", () => {
    expect(parseDemoEvents({ events: [{ name: "anything" }] })).toBeNull();
    expect(parseDemoEvents({ events: [{ name: "demo_completed", email: "patient@example.com" }] })).toBeNull();
    expect(parseDemoEvents({ events: [] })).toBeNull();
  });

  it("caps an event batch at twenty", () => {
    expect(parseDemoEvents({ events: Array.from({ length: 21 }, () => ({ name: "demo_completed" })) })).toBeNull();
  });

  it("only accepts the fixed marketing page-view shape", () => {
    expect(parseMarketingPageView({ name: "marketing_page_viewed", page: "landing" })).toBe("landing");
    expect(parseMarketingPageView({ name: "marketing_page_viewed", page: "https://bad.example/?email=a@b.com" })).toBeNull();
    expect(parseMarketingPageView({ name: "marketing_page_viewed", page: "demo", referrer: "https://elsewhere.example" })).toBeNull();
  });
});
