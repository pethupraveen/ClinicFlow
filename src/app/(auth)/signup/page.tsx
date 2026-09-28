import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { SignupForm } from "@/modules/auth/components/AuthForms";
import { getSessionUser } from "@/modules/auth/guards";
import { getTrialPlan } from "@/modules/subscriptions/plans";

export const metadata: Metadata = { title: "Start Free Trial" };

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/app");
  const { trialDays } = getTrialPlan();
  return (
    <AuthShell
      title={`Start your ${trialDays}-day free trial`}
      subtitle="No credit card required. Set up your clinic in minutes."
      footer={
        <>
          Already have an account? <Link href="/login">Log in</Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
