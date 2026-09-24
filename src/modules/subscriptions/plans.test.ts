import { describe, expect, it } from "vitest";
import seed from "./plans.seed.json";
import { formatPrice, getPublicPlans, getTrialPlan, parseCatalog } from "./plans";
import { planBullets } from "@/modules/marketing/planBullets";

type RawPlan = Record<string, unknown> & { limits: Record<string, unknown> };
type RawCatalog = { plans: RawPlan[]; settings: Record<string, unknown> };

const clone = (): RawCatalog => JSON.parse(JSON.stringify(seed));

describe("plan catalogue", () => {
  it("exposes the three public plans in order, hiding the trial plan", () => {
    expect(getPublicPlans().map((p) => p.code)).toEqual(["STARTER", "GROWTH", "PRO"]);
  });

  it("has a 15-day trial", () => {
    expect(getTrialPlan().trialDays).toBe(15);
  });

  it("stores prices in paise", () => {
    expect(getPublicPlans().map((p) => formatPrice(p.pricePaise, p.currency))).toEqual(["₹1,499", "₹2,499", "₹3,999"]);
  });

  const cases: Array<[string, (c: RawCatalog) => void]> = [
    ["negative price", (c) => { c.plans[1].pricePaise = -1; }],
    ["fractional price", (c) => { c.plans[1].pricePaise = 1499.5; }],
    ["duplicate code", (c) => { c.plans[2].code = "STARTER"; }],
    ["missing limit", (c) => { delete c.plans[1].limits.doctors; }],
    ["public plan without billing cycle", (c) => { c.plans[1].billingCycle = "NONE"; }],
    ["no trial plan", (c) => { delete c.plans[0].trialDays; }],
    ["bad currency", (c) => { c.plans[1].currency = "rupees"; }],
  ];

  it.each(cases)("rejects a catalogue with %s", (_name, mutate) => {
    const c = clone();
    mutate(c);
    expect(() => parseCatalog(c)).toThrow(/Invalid plan catalogue/);
  });

  it("accepts null as an unlimited limit", () => {
    const c = clone();
    c.plans[3].limits.doctors = null;
    const pro = parseCatalog(c).plans.find((p) => p.code === "PRO")!;
    expect(pro.limits.doctors).toBeNull();
    expect(planBullets(pro)[0]).toBe("Unlimited doctors");
  });
});

describe("pricing bullets", () => {
  it("are derived from plan limits, not hard-coded", () => {
    const starter = getPublicPlans()[0];
    const bullets = planBullets({ ...starter, limits: { ...starter.limits, doctors: 7, appointments: 1234 } });
    expect(bullets).toContain("Up to 7 doctors");
    expect(bullets).toContain("1,234 appointments / month");
  });

  it("uses the singular for one", () => {
    expect(planBullets(getPublicPlans()[0])).toContain("Up to 1 doctor");
  });
});
