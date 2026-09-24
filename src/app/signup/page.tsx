import type { Metadata } from "next";
import { ComingSoon } from "@/modules/marketing/components/ComingSoon";
import { getTrialPlan } from "@/modules/subscriptions/plans";

// Placeholder until Phase 4 (signup) ships.
export const metadata: Metadata = {
  title: "Start Free Trial",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  const { trialDays } = getTrialPlan();
  return (
    <ComingSoon
      title={`Your ${trialDays}-day free trial is almost ready`}
      body="Clinic sign-up opens shortly. No credit card will be required."
    />
  );
}
