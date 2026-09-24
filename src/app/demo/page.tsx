import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/site";
import { DemoLoader } from "@/modules/demo/components/DemoLoader";
import { LogoMark } from "@/modules/marketing/components/Sections";
import ls from "@/modules/marketing/landing.module.css";
import s from "@/modules/demo/demo.module.css";
import { getTrialPlan } from "@/modules/subscriptions/plans";

export const metadata: Metadata = {
  title: "Live Demo — Book a Sample Appointment on WhatsApp",
  description:
    "Try ClinicFlow WhatsApp without signing up: book an appointment at a demo dental clinic the way a patient would, then see it appear in the clinic dashboard.",
  alternates: { canonical: ROUTES.demo },
};

export default function DemoPage() {
  const { trialDays } = getTrialPlan();
  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <Link href={ROUTES.home} className={ls.logo} aria-label="ClinicFlow WhatsApp home">
            <LogoMark />
            <span>ClinicFlow</span>
          </Link>
          <Link href={`${ROUTES.signup}?from=demo`} className={`${ls.btn} ${ls.btnPrimary} ${ls.btnSmall}`}>
            Start {trialDays}-day free trial
          </Link>
        </div>
      </header>
      <main>
        <div className={s.intro}>
          <h1 className={s.introTitle}>
            Try it as a patient <span className={s.sampleTag}>Demo</span>
          </h1>
          <p className={s.introText}>
            Book an appointment at SmileCare, a sample dental clinic. Tap the buttons just as a patient would.
          </p>
        </div>
        <DemoLoader trialDays={trialDays} />
      </main>
    </div>
  );
}
