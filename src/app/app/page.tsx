import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { logoutAction } from "@/modules/auth/actions";
import s from "@/modules/auth/components/auth.module.css";
import { requireMember } from "@/modules/auth/guards";
import { LogoMark } from "@/modules/marketing/components/Sections";
import { trialSummary } from "@/modules/trial/dates";
import { findSubscription } from "@/modules/trial/store";

export default async function AppHomePage() {
  const { membership, user } = await requireMember("/app");
  const subscription = await findSubscription(membership.business.id);
  const trial = subscription ? trialSummary(subscription, new Date(), subscription.timeZone) : null;
  return (
    <>
      <header className={s.appHeader}>
        <div className={s.appHeaderInner}>
          <Link href="/app" className={s.brand} style={{ marginBottom: 0 }}>
            <LogoMark />
            <span>{membership.business.name}</span>
          </Link>
          <form action={logoutAction}>
            <button type="submit" className={s.linkButton}>
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className={s.appMain}>
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
            Your {SITE_NAME} account for {membership.business.name} is ready. You&apos;re signed in as {user.email}.
            Clinic setup — doctors, schedules and your WhatsApp bot — arrives in the next steps.
          </p>
        </section>
      </main>
    </>
  );
}
