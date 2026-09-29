import { describe, expect, it } from "vitest";
import { effectiveStatus, startOfLocalDay, trialEndsAt, trialSummary } from "./dates";

const IST = "Asia/Kolkata";
const at = (iso: string) => new Date(iso);

describe("trialEndsAt", () => {
  it("ends at local midnight at the start of day 15 (signup day is day 0)", () => {
    // 29 Sep 10:00 IST → 14 Oct 00:00 IST
    expect(trialEndsAt(at("2026-09-29T04:30:00Z"), 15, IST).toISOString()).toBe("2026-10-13T18:30:00.000Z");
  });

  it("uses the clinic's local date at the signup boundary", () => {
    // 29 Sep 23:59:59 IST is still 29 Sep …
    expect(trialEndsAt(at("2026-09-29T18:29:59Z"), 15, IST).toISOString()).toBe("2026-10-13T18:30:00.000Z");
    // … but 30 Sep 00:00 IST is the next day.
    expect(trialEndsAt(at("2026-09-29T18:30:00Z"), 15, IST).toISOString()).toBe("2026-10-14T18:30:00.000Z");
  });

  it("crosses month and year ends", () => {
    expect(trialEndsAt(at("2026-12-25T06:00:00Z"), 15, IST).toISOString()).toBe("2027-01-08T18:30:00.000Z");
  });

  it("lands on local midnight across a daylight-saving change", () => {
    // New York leaves DST on 1 Nov 2026; midnight on 9 Nov is 05:00 UTC.
    expect(trialEndsAt(at("2026-10-25T16:00:00Z"), 15, "America/New_York").toISOString()).toBe("2026-11-09T05:00:00.000Z");
    expect(startOfLocalDay({ year: 2026, month: 7, day: 1 }, "America/New_York").toISOString()).toBe("2026-07-01T04:00:00.000Z");
  });
});

describe("effectiveStatus", () => {
  const trial = { status: "TRIAL" as const, trialEndsAt: at("2026-10-13T18:30:00Z") };

  it("expires exactly at trial_ends_at, even before the job saves it", () => {
    expect(effectiveStatus(trial, at("2026-10-13T18:29:59.999Z"))).toBe("TRIAL");
    expect(effectiveStatus(trial, at("2026-10-13T18:30:00Z"))).toBe("EXPIRED");
  });

  it("leaves other statuses alone", () => {
    expect(effectiveStatus({ status: "ACTIVE", trialEndsAt: at("2020-01-01T00:00:00Z") }, at("2026-10-20T00:00:00Z"))).toBe("ACTIVE");
  });
});

describe("trialSummary", () => {
  const trial = { status: "TRIAL" as const, trialEndsAt: at("2026-10-13T18:30:00Z") }; // 14 Oct 00:00 IST

  it("counts calendar days in the clinic's time zone", () => {
    expect(trialSummary(trial, at("2026-09-29T04:30:00Z"), IST)).toMatchObject({
      state: "trial",
      daysLeft: 15,
      endsOn: "14 Oct",
      label: "Free trial · 15 days left · ends 14 Oct",
    });
    // Day 12 (11 Oct IST) → 3 left
    expect(trialSummary(trial, at("2026-10-11T06:00:00Z"), IST)).toMatchObject({ daysLeft: 3 });
  });

  it("says 'ends tomorrow' through the last second of day 14", () => {
    expect(trialSummary(trial, at("2026-10-12T18:30:00Z"), IST)).toMatchObject({ daysLeft: 1, label: "Free trial · ends tomorrow" });
    expect(trialSummary(trial, at("2026-10-13T18:29:59Z"), IST)).toMatchObject({ daysLeft: 1 });
  });

  it("has ended on day 15", () => {
    expect(trialSummary(trial, at("2026-10-13T18:30:00Z"), IST)).toEqual({ state: "expired", label: "Your free trial has ended" });
  });
});
