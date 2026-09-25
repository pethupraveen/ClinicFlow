import Link from "next/link";
import {
  BellRing,
  CalendarCheck,
  LayoutDashboard,
  MessageCircleQuestion,
  Headset,
  Play,
  Plus,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { ROUTES, SITE_NAME } from "@/lib/site";
import { PrivacyNotice } from "@/modules/analytics/components/PrivacyNotice";
import { FEATURES, HOW_IT_WORKS, type Faq, type FeatureIcon } from "../content";
import { ChatMock, FULL_CHAT, HERO_CHAT } from "./ChatMock";
import { DashboardMock } from "./DashboardMock";
import s from "../landing.module.css";

export function LogoMark() {
  return (
    <svg className={s.logoMark} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 3C8.8 3 3 8.4 3 15.1c0 2.4.8 4.7 2.1 6.6L3.6 28l6.6-1.7c1.8.9 3.8 1.4 5.8 1.4 7.2 0 13-5.4 13-12.1S23.2 3 16 3Z"
        fill="var(--brand)"
      />
      <path d="M14.3 9.5h3.4v4h4v3.4h-4v4h-3.4v-4h-4v-3.4h4z" fill="#fff" />
    </svg>
  );
}

function TrialNote({ trialDays }: { trialDays: number }) {
  return (
    <p className={s.trialNote}>
      <ShieldCheck aria-hidden="true" />
      {trialDays}-Day Free Trial • No Credit Card Required
    </p>
  );
}

function CtaButtons({ trialDays, id }: { trialDays: number; id?: string }) {
  return (
    <div className={s.ctaRow} id={id}>
      <Link href={ROUTES.demo} className={`${s.btn} ${s.btnPrimary}`}>
        <Play aria-hidden="true" size={18} fill="currentColor" />
        Try Live Demo
      </Link>
      <Link href={ROUTES.signup} className={`${s.btn} ${s.btnSecondary}`}>
        Start {trialDays}-Day Free Trial
      </Link>
    </div>
  );
}

export function Header({ trialDays }: { trialDays: number }) {
  return (
    <header className={s.header}>
      <div className={`${s.container} ${s.headerInner}`}>
        <Link href={ROUTES.home} className={s.logo} aria-label={`${SITE_NAME} home`}>
          <LogoMark />
          <span>
            ClinicFlow<span className={s.logoSub}> WhatsApp</span>
          </span>
        </Link>
        <nav className={s.nav} aria-label="Main">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link href={ROUTES.signup} className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`}>
          <span className="visually-hidden">Start {trialDays}-day </span>Free trial
        </Link>
      </div>
    </header>
  );
}

export function Hero({ trialDays }: { trialDays: number }) {
  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={`${s.container} ${s.heroGrid}`}>
        <div>
          <span className={s.eyebrow}>WhatsApp appointment booking for clinics</span>
          <h1 id="hero-title" className={s.h1}>
            Your Clinic&apos;s WhatsApp Receptionist
          </h1>
          <p className={s.heroSub}>
            Let patients book appointments, check availability and get important clinic information through
            WhatsApp — automatically.
          </p>
          <CtaButtons trialDays={trialDays} id="hero-ctas" />
          <TrialNote trialDays={trialDays} />
        </div>
        <figure className={s.heroVisual} aria-label="Example: a patient books an appointment on WhatsApp">
          <ChatMock items={HERO_CHAT} clinicName="SmileCare Dental Clinic" />
          <div className={s.bookingToast} aria-hidden="true">
            <span className={s.toastIcon}>
              <CalendarCheck />
            </span>
            <span>
              <strong>New appointment</strong>
              Dr. Arun · Tomorrow · 10:30 AM
            </span>
          </div>
        </figure>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className={`${s.section} ${s.sectionSoft}`} aria-labelledby="how-title">
      <div className={s.container}>
        <div className={s.sectionHead}>
          <span className={s.eyebrow}>How it works</span>
          <h2 id="how-title" className={s.h2}>
            Set up once. Patients book on their own.
          </h2>
        </div>
        <ol className={s.steps}>
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className={s.step}>
              <span className={s.stepNum} aria-hidden="true">
                {i + 1}
              </span>
              <h3 className={s.cardTitle}>
                <span className="visually-hidden">Step {i + 1}: </span>
                {step.title}
              </h3>
              <p className={s.cardBody}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FEATURE_ICONS: Record<FeatureIcon, LucideIcon> = {
  booking: CalendarCheck,
  scheduling: Stethoscope,
  reminders: BellRing,
  faq: MessageCircleQuestion,
  handoff: Headset,
  dashboard: LayoutDashboard,
};

export function Features() {
  return (
    <section id="features" className={s.section} aria-labelledby="features-title">
      <div className={s.container}>
        <div className={s.sectionHead}>
          <span className={s.eyebrow}>Features</span>
          <h2 id="features-title" className={s.h2}>
            Automate routine appointment conversations
          </h2>
          <p className={s.lead}>Give your receptionist fewer repetitive tasks, and let patients book when it suits them.</p>
        </div>
        <ul className={s.features}>
          {FEATURES.map((feature) => {
            const Icon = FEATURE_ICONS[feature.icon];
            return (
              <li key={feature.title} className={s.feature}>
                <span className={s.featureIcon} aria-hidden="true">
                  <Icon />
                </span>
                <h3 className={s.cardTitle}>{feature.title}</h3>
                <p className={s.cardBody}>{feature.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function DemoBand() {
  return (
    <section className={s.section} aria-labelledby="demo-title" style={{ paddingTop: 0 }}>
      <div className={s.container}>
        <div className={s.demoBand}>
          <div>
            <h2 id="demo-title" className={s.h2}>
              See how it works before you sign up.
            </h2>
            <p className={s.demoBandText}>
              Book a sample appointment at a demo dental clinic, then see it appear in the clinic dashboard. No
              sign-up or WhatsApp account needed.
            </p>
          </div>
          <Link href={ROUTES.demo} className={`${s.btn} ${s.btnPrimary}`}>
            <Play aria-hidden="true" size={18} fill="currentColor" />
            Try Live Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Previews() {
  return (
    <section className={`${s.section} ${s.sectionSoft}`} aria-labelledby="previews-title">
      <div className={s.container}>
        <div className={s.sectionHead}>
          <span className={s.eyebrow}>From WhatsApp to your appointment list</span>
          <h2 id="previews-title" className={s.h2}>
            Patients book in WhatsApp. Your team sees it in the dashboard.
          </h2>
        </div>
        <div className={s.previewGrid}>
          <figure>
            <p className={s.previewLabel}>
              <span aria-hidden="true">1</span> What your patient sees
            </p>
            <ChatMock items={FULL_CHAT} clinicName="SmileCare Dental Clinic" />
            <figcaption className={s.figcaption}>Example conversation with a sample clinic.</figcaption>
          </figure>
          <figure>
            <p className={s.previewLabel}>
              <span aria-hidden="true">2</span> What your clinic sees
            </p>
            <DashboardMock />
            <figcaption className={s.figcaption}>
              The new booking appears in the dashboard straight away. Sample data.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section id="faq" className={`${s.section} ${s.sectionSoft}`} aria-labelledby="faq-title">
      <div className={s.container}>
        <div className={`${s.sectionHead} ${s.sectionHeadCenter}`}>
          <span className={s.eyebrow}>FAQ</span>
          <h2 id="faq-title" className={s.h2}>
            Common questions
          </h2>
        </div>
        <div className={s.faqList}>
          {faqs.map((faq) => (
            <details key={faq.question} className={s.faq}>
              <summary>
                {faq.question}
                <Plus aria-hidden="true" />
              </summary>
              <p className={s.faqAnswer}>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ trialDays }: { trialDays: number }) {
  return (
    <section className={s.section} aria-labelledby="final-title">
      <div className={`${s.container} ${s.finalCta}`} id="final-cta">
        <h2 id="final-title" className={s.h2}>
          Ready to automate your clinic&apos;s WhatsApp appointments?
        </h2>
        <div className={s.ctaRow}>
          <Link href={ROUTES.signup} className={`${s.btn} ${s.btnPrimary}`}>
            Start {trialDays}-Day Free Trial
          </Link>
          <Link href={ROUTES.demo} className={`${s.btn} ${s.btnSecondary}`}>
            Try Live Demo
          </Link>
        </div>
        <TrialNote trialDays={trialDays} />
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={s.footer}>
      <div className={`${s.container} ${s.footerInner}`}>
        <div>
          <Link href={ROUTES.home} className={s.logo}>
            <LogoMark />
            <span>{SITE_NAME}</span>
          </Link>
          <p className={s.footerLegal}>
            © {new Date().getFullYear()} {SITE_NAME}. WhatsApp is a trademark of Meta Platforms, Inc. ClinicFlow is
            not affiliated with Meta.
          </p>
          <PrivacyNotice className={s.footerLegal} />
        </div>
        <nav className={s.footerLinks} aria-label="Footer">
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <Link href={ROUTES.demo}>Live demo</Link>
          <Link href={ROUTES.signup}>Free trial</Link>
        </nav>
      </div>
    </footer>
  );
}
