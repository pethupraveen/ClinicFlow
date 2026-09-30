import { describe, expect, it } from "vitest";
import { computeProgress, stepByNumber, type OnboardingFacts } from "./steps";

const empty: OnboardingFacts = {
  clinicInfoComplete: false,
  doctorCount: 0,
  doctorsWithHours: 0,
  faqCount: 0,
  faqSkipped: false,
  emailVerified: true,
  whatsappConnected: false,
  botTested: false,
  isLive: false,
};

describe("computeProgress", () => {
  it("counts a Google-verified email as the first mandatory item", () => {
    const p = computeProgress(empty);
    expect(p.percent).toBe(20);
    expect(p.next?.key).toBe("clinic");
  });

  it("derives each step from real data; WhatsApp completes the mandatory items", () => {
    const p = computeProgress({ ...empty, clinicInfoComplete: true, doctorCount: 2, doctorsWithHours: 1, faqCount: 3 });
    expect(p.steps.filter((s) => s.done).map((s) => s.key)).toEqual(["clinic", "doctors", "schedules", "faq"]);
    expect(p.percent).toBe(80);
    expect(p.next?.key).toBe("whatsapp");
    const ready = computeProgress({ ...empty, clinicInfoComplete: true, doctorCount: 1, doctorsWithHours: 1, faqCount: 1, whatsappConnected: true, botTested: true });
    expect(ready.percent).toBe(100);
    expect(ready.next?.key).toBe("golive");
    expect(computeProgress({ ...empty, clinicInfoComplete: true, doctorCount: 1, doctorsWithHours: 1, faqCount: 1, whatsappConnected: true, botTested: true, isLive: true }).next).toBeNull();
  });

  it("needs a doctor with hours, not just a doctor", () => {
    const p = computeProgress({ ...empty, clinicInfoComplete: true, doctorCount: 1 });
    expect(p.percent).toBe(60);
    expect(p.next?.key).toBe("schedules");
  });

  it("treats a skipped FAQ as done but not as a mandatory item", () => {
    const skipped = computeProgress({ ...empty, faqSkipped: true });
    expect(skipped.steps[3].done).toBe(true);
    expect(skipped.percent).toBe(20);
  });
});

describe("stepByNumber", () => {
  it("accepts 1–7 only", () => {
    expect(stepByNumber("1")?.key).toBe("clinic");
    expect(stepByNumber("7")?.key).toBe("golive");
    for (const bad of ["0", "8", "01", "1a", "", "../1"]) expect(stepByNumber(bad)).toBeNull();
  });
});
