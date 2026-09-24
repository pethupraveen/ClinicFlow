import { getCatalogSettings, getTrialPlan } from "@/modules/subscriptions/plans";

export const HOW_IT_WORKS = [
  {
    title: "Create your clinic",
    body: "Add your clinic name, address, phone number and working hours.",
  },
  {
    title: "Configure doctors and schedules",
    body: "Set each doctor's working days, hours, breaks and appointment length.",
  },
  {
    title: "Connect WhatsApp",
    body: "Link your clinic's number through Meta's official WhatsApp Business Platform.",
  },
  {
    title: "Patients start booking",
    body: "Patients choose a doctor, date and time in WhatsApp. The booking appears in your dashboard.",
  },
] as const;

export type FeatureIcon = "booking" | "scheduling" | "reminders" | "faq" | "handoff" | "dashboard";

export const FEATURES: ReadonlyArray<{ icon: FeatureIcon; title: string; body: string }> = [
  {
    icon: "booking",
    title: "Appointment Booking",
    body: "Patients pick a doctor, date and open time slot inside WhatsApp. Only available slots are offered.",
  },
  {
    icon: "scheduling",
    title: "Doctor Scheduling",
    body: "Working days, hours, breaks and appointment length for every doctor.",
  },
  {
    icon: "reminders",
    title: "WhatsApp Reminders",
    body: "Automatic reminders before each appointment, so fewer patients forget.",
  },
  {
    icon: "faq",
    title: "FAQ Automation",
    body: "Answer routine questions about timings, location and fees with answers you write.",
  },
  {
    icon: "handoff",
    title: "Human Handoff",
    body: "Patients can ask for reception at any time, and your receptionist takes over the chat.",
  },
  {
    icon: "dashboard",
    title: "Clinic Dashboard",
    body: "Today's appointments, patients and WhatsApp conversations in one place.",
  },
];

export interface Faq {
  question: string;
  answer: string;
}

/** FAQ answers that mention limits read them from plan config, never literals. */
export function getFaqs(): Faq[] {
  const trial = getTrialPlan();
  const { expiredDataRetentionDays } = getCatalogSettings();
  const limit = (n: number | null, noun: string) => (n === null ? `unlimited ${noun}` : `up to ${n} ${noun}`);

  return [
    {
      question: `What is the ${trial.trialDays}-day trial?`,
      answer: `You get ${trial.trialDays} days to set up your clinic, add doctors, connect WhatsApp and take real bookings. The trial includes ${limit(trial.limits.doctors, "doctors")}, ${limit(trial.limits.appointments, "appointments")} and ${limit(trial.limits.conversations, "WhatsApp conversations")}.`,
    },
    {
      question: "Do I need a credit card?",
      answer: "No. You only add payment details if you decide to upgrade to a paid plan.",
    },
    {
      question: "Can I use my own WhatsApp number?",
      answer:
        "Yes. ClinicFlow connects to your clinic's own number through Meta's official WhatsApp Business Platform. Setup includes a short verification with Meta, and we guide you through each step.",
    },
    {
      question: "Can I add multiple doctors?",
      answer:
        "Yes. Each doctor has their own schedule, appointment length and consultation fee. The number of doctors depends on your plan.",
    },
    {
      question: "Can patients cancel appointments?",
      answer: "Yes. Patients can cancel from WhatsApp, and the time slot becomes available for other patients again.",
    },
    {
      question: "Can my receptionist take over a conversation?",
      answer:
        "Yes. Patients can choose “Talk to Reception” at any time, and your staff can reply to any conversation from the dashboard.",
    },
    {
      question: "What happens when my trial ends?",
      answer: `Automated booking pauses until you choose a plan. You can still log in, see your appointments and export your data. Your clinic data is kept for ${expiredDataRetentionDays} days after the trial ends.`,
    },
  ];
}
