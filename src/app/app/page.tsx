import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import s from "@/modules/auth/components/auth.module.css";
import { requireMember } from "@/modules/auth/guards";
import { ProgressBar } from "@/modules/onboarding/components/OnboardingShell";
import o from "@/modules/onboarding/components/onboarding.module.css";
import { computeProgress } from "@/modules/onboarding/steps";
import { getOnboardingFacts } from "@/modules/onboarding/store";
import { trialSummary } from "@/modules/trial/dates";
import { findSubscription } from "@/modules/trial/store";

export default async function AppHomePage() {
  const { membership, user } = await requireMember("/app");
  const [subscription, facts] = await Promise.all([
    findSubscription(membership.business.id),
    getOnboardingFacts(membership.business.id, membership.emailVerified),
  ]);
  const trial = subscription ? trialSummary(subscription, new Date(), subscription.timeZone) : null;
  const progress = computeProgress(facts);

  return (
    <>
      {trial?.state === "trial" ? (
        <p className={s.notice} role="status">
          {trial.label}
        </p>
      ) : null}
      {trial?.state === "expired" ? (
        <p className={s.warn} role="status">
          {trial.label}. Upgrade options arrive soon; contact us to keep using {SITE_NAME}.
        </p>
      ) : null}
      <section className={s.panel}>
        <h1 className={s.title}>Welcome, {membership.fullName.split(" ")[0]}!</h1>
        <p className={s.subtitle}>
          You&apos;re signed in as {user.email}. Set up {membership.business.name} so your WhatsApp receptionist knows
          your doctors, hours and common questions.
        </p>
      </section>
      <section className={s.panel}>
        <ProgressBar progress={progress} />
        <div className={o.setupCard}>
          <span>
            {progress.next ? (
              <>
                Next: <strong>{progress.next.title}</strong>
              </>
            ) : (
              "Clinic setup is done for now. WhatsApp connection and Go Live are coming next."
            )}
          </span>
          <Link href={progress.next ? `/app/onboarding/${progress.next.number}` : "/app/onboarding/1"} className={o.primaryLink}>
            {progress.next ? "Continue setup" : "Review setup"}
          </Link>
        </div>
      </section>
    </>
  );
}
