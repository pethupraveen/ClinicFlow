import type { Plan } from "@/modules/subscriptions/plans";

const FEATURE_LABELS: Record<string, string> = {
  booking: "WhatsApp booking",
  reminders: "reminders",
  faq: "FAQ automation",
  handoff: "human handoff",
  dashboard: "clinic dashboard",
};

const nf = new Intl.NumberFormat("en-IN");

function amount(limit: number | null, one: string, many: string, suffix = ""): string {
  if (limit === null) return `Unlimited ${many}${suffix}`;
  return `${nf.format(limit)} ${limit === 1 ? one : many}${suffix}`;
}

/** Pricing-card bullet points, derived entirely from plan config. */
export function planBullets(plan: Plan): string[] {
  const { limits } = plan;
  const bullets = [
    limits.doctors === null ? "Unlimited doctors" : `Up to ${amount(limits.doctors, "doctor", "doctors")}`,
    amount(limits.staff_users, "staff login", "staff logins"),
    amount(limits.appointments, "appointment", "appointments", " / month"),
    amount(limits.conversations, "WhatsApp conversation", "WhatsApp conversations", " / month"),
  ];
  const features = Object.entries(plan.features)
    .filter(([, on]) => on)
    .map(([key]) => FEATURE_LABELS[key])
    .filter(Boolean);
  if (features.length) {
    const text = features.join(", ");
    bullets.push(text.charAt(0).toUpperCase() + text.slice(1));
  }
  return bullets;
}
