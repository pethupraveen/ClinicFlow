import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import authStyles from "@/modules/auth/components/auth.module.css";
import { requireMember } from "@/modules/auth/guards";
import { TestChat } from "@/modules/bot/components/TestChat";
import { transcript } from "@/modules/bot/store";
import { archiveDoctorAction, deleteFaqAction, skipFaqAction } from "@/modules/onboarding/actions";
import { OnboardingShell } from "@/modules/onboarding/components/OnboardingShell";
import s from "@/modules/onboarding/components/onboarding.module.css";
import { ClinicInfoForm, DoctorForm, FaqForm, ScheduleEditor } from "@/modules/onboarding/components/StepForms";
import { summarizeHours } from "@/modules/onboarding/schedule";
import { computeProgress, stepByNumber } from "@/modules/onboarding/steps";
import { getClinicInfo, getOnboardingFacts, listDoctors, listFaqs } from "@/modules/onboarding/store";
import { GoLiveStep, WhatsAppStep } from "@/modules/whatsapp/components/Steps";
import { clinicWhatsApp } from "@/modules/whatsapp/store";

export const metadata: Metadata = { title: "Set up your clinic" };

function Footer({ next, nextLabel }: { next?: number; nextLabel?: string }) {
  return (
    <div className={s.actions}>
      {next ? (
        <Link href={`/app/onboarding/${next}`} className={s.primaryLink}>
          {nextLabel}
        </Link>
      ) : null}
      <Link href="/app" className={s.secondary}>
        Continue later
      </Link>
    </div>
  );
}

export default async function OnboardingStepPage({ params, searchParams }: PageProps<"/app/onboarding/[step]">) {
  const step = stepByNumber((await params).step);
  if (!step) notFound();
  const { membership } = await requireMember(`/app/onboarding/${step.number}`);
  const businessId = membership.business.id;
  const progress = computeProgress(await getOnboardingFacts(businessId, membership.emailVerified));

  let body: React.ReactNode;
  switch (step.key) {
    case "clinic": {
      body = <ClinicInfoForm info={await getClinicInfo(businessId)} />;
      break;
    }
    case "doctors": {
      const doctors = await listDoctors(businessId);
      body = (
        <>
          <p className={s.muted}>Add every doctor patients can book. You can change these any time.</p>
          {doctors.map((d) => (
            <div key={d.publicId} className={s.item}>
              <div className={s.itemHead}>
                <strong>{d.name}</strong>
                <form action={archiveDoctorAction}>
                  <input type="hidden" name="doctor" value={d.publicId} />
                  <button type="submit" className={s.danger}>
                    Remove
                  </button>
                </form>
              </div>
              <DoctorForm doctor={d} />
            </div>
          ))}
          <div className={s.item}>
            <strong>{doctors.length ? "Add another doctor" : "Add your first doctor"}</strong>
            <DoctorForm />
          </div>
          <Footer next={doctors.length ? 3 : undefined} nextLabel="Continue to working hours" />
        </>
      );
      break;
    }
    case "schedules": {
      const doctors = await listDoctors(businessId);
      const wanted = (await searchParams).doctor;
      const selected = doctors.find((d) => d.publicId === wanted) ?? doctors[0];
      body = selected ? (
        <>
          <nav className={s.tabs} aria-label="Doctors">
            {doctors.map((d) => (
              <Link
                key={d.publicId}
                href={`/app/onboarding/3?doctor=${d.publicId}`}
                className={s.tab}
                aria-current={d.publicId === selected.publicId ? "page" : undefined}
              >
                {d.name} · <span className={s.muted}>{summarizeHours(d.hours)}</span>
              </Link>
            ))}
          </nav>
          <ScheduleEditor doctorId={selected.publicId} appointmentMinutes={selected.appointmentMinutes} hours={selected.hours} />
          <Footer next={4} nextLabel="Continue to common questions" />
        </>
      ) : (
        <p className={s.muted}>
          Add a doctor first.{" "}
          <Link href="/app/onboarding/2" className={authStyles.inlineLink}>
            Go to Doctors
          </Link>
        </p>
      );
      break;
    }
    case "faq": {
      const faqs = await listFaqs(businessId);
      body = (
        <>
          <p className={s.muted}>
            Your bot answers these for patients, so reception gets fewer calls. Optional, and you can add more later.
          </p>
          {faqs.map((f) => (
            <div key={f.publicId} className={s.item}>
              <div className={s.itemHead}>
                <strong>{f.question}</strong>
                <form action={deleteFaqAction}>
                  <input type="hidden" name="faq" value={f.publicId} />
                  <button type="submit" className={s.danger}>
                    Delete
                  </button>
                </form>
              </div>
              <p className={s.muted} style={{ whiteSpace: "pre-line" }}>
                {f.answer}
              </p>
            </div>
          ))}
          <FaqForm />
          <div className={s.actions}>
            <Link href="/app" className={s.primaryLink}>
              {faqs.length ? "Done for now" : "Continue later"}
            </Link>
            {faqs.length === 0 && !progress.steps[3].done ? (
              <form action={skipFaqAction}>
                <button type="submit" className={s.secondary}>
                  Skip this step
                </button>
              </form>
            ) : null}
          </div>
        </>
      );
      break;
    }
    case "whatsapp": {
      body = (
        <>
          <WhatsAppStep wa={await clinicWhatsApp(businessId)} />
          <Footer next={6} nextLabel="Continue to test your bot" />
        </>
      );
      break;
    }
    case "golive": {
      body = (
        <>
          <GoLiveStep wa={await clinicWhatsApp(businessId)} progress={progress} emailVerified={membership.emailVerified} />
          <Footer />
        </>
      );
      break;
    }
    case "test": {
      const entries = await transcript(businessId, "TEST_CHAT", `test:${membership.userId}`);
      body = (
        <>
          <p className={s.muted}>
            This is your real bot, running on the clinic details, doctors and hours you set up. Book an appointment as if
            you were a patient. Test bookings are marked as tests and never block real patients&apos; slots.
          </p>
          {progress.steps[2].done ? null : (
            <p className={authStyles.warn}>
              No doctor has working hours yet, so there&apos;s nothing to book.{" "}
              <Link href="/app/onboarding/3" className={authStyles.inlineLink}>
                Set working hours
              </Link>
            </p>
          )}
          <TestChat clinicName={membership.business.name} entries={entries} />
          <Footer next={progress.steps[5].done ? 7 : undefined} nextLabel="Continue" />
          {progress.steps[5].done ? (
            <p className={s.muted}>
              ✅ Test booking done — your clinic is activated.{" "}
              <Link href="/app/appointments" className={authStyles.inlineLink}>
                See appointments
              </Link>
            </p>
          ) : null}
        </>
      );
      break;
    }
    default: {
      body = (
        <>
          <p className={s.muted}>{step.comingIn}</p>
          <Footer />
        </>
      );
    }
  }

  return (
    <OnboardingShell progress={progress} current={step.number}>
      <div>
        <p className={s.muted}>
          Step {step.number} of 7
        </p>
        <h1 className={authStyles.title}>{step.title}</h1>
      </div>
      {body}
    </OnboardingShell>
  );
}
