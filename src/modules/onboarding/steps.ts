export type StepKey = "clinic" | "doctors" | "schedules" | "faq" | "whatsapp" | "test" | "golive";

export interface StepDef {
  number: number;
  key: StepKey;
  title: string;
  /** False for steps that arrive in a later part of Phase 6. */
  available: boolean;
  comingIn?: string;
}

export const STEPS: readonly StepDef[] = [
  { number: 1, key: "clinic", title: "Clinic information", available: true },
  { number: 2, key: "doctors", title: "Doctors", available: true },
  { number: 3, key: "schedules", title: "Working hours", available: true },
  { number: 4, key: "faq", title: "Common questions", available: true },
  { number: 5, key: "whatsapp", title: "WhatsApp", available: true },
  { number: 6, key: "test", title: "Test your bot", available: true },
  { number: 7, key: "golive", title: "Go live", available: true },
];

/** What the database says about a clinic's setup. */
export interface OnboardingFacts {
  clinicInfoComplete: boolean;
  doctorCount: number;
  doctorsWithHours: number;
  faqCount: number;
  faqSkipped: boolean;
  emailVerified: boolean;
  whatsappConnected: boolean;
  botTested: boolean;
  isLive: boolean;
}

export interface StepState extends StepDef {
  done: boolean;
}

export interface Progress {
  steps: StepState[];
  /** Mandatory items for Go Live: clinic info, a doctor, hours, verified email, WhatsApp. */
  mandatoryDone: number;
  mandatoryTotal: number;
  percent: number;
  /** First available step that isn't done, or null when all available steps are. */
  next: StepState | null;
}

export function computeProgress(f: OnboardingFacts): Progress {
  const done: Record<StepKey, boolean> = {
    clinic: f.clinicInfoComplete,
    doctors: f.doctorCount > 0,
    schedules: f.doctorsWithHours > 0,
    faq: f.faqCount > 0 || f.faqSkipped,
    whatsapp: f.whatsappConnected,
    test: f.botTested,
    golive: f.isLive,
  };
  const steps = STEPS.map((step) => ({ ...step, done: done[step.key] }));
  const mandatory = [done.clinic, done.doctors, done.schedules, f.emailVerified, done.whatsapp];
  const mandatoryDone = mandatory.filter(Boolean).length;
  return {
    steps,
    mandatoryDone,
    mandatoryTotal: mandatory.length,
    percent: Math.round((mandatoryDone / mandatory.length) * 100),
    next: steps.find((step) => step.available && !step.done) ?? null,
  };
}

export function stepByNumber(value: string): StepDef | null {
  if (!/^[1-7]$/.test(value)) return null;
  return STEPS[Number(value) - 1];
}
