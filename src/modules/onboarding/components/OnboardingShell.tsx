import Link from "next/link";
import type { ReactNode } from "react";
import type { Progress } from "../steps";
import s from "./onboarding.module.css";

export function ProgressBar({ progress }: { progress: Progress }) {
  return (
    <>
      <div className={s.progressLabel}>Setup {progress.percent}% complete</div>
      <div
        className={s.bar}
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Clinic setup progress"
      >
        <div className={s.barFill} style={{ width: `${progress.percent}%` }} />
      </div>
    </>
  );
}

export function OnboardingShell({ progress, current, children }: { progress: Progress; current: number; children: ReactNode }) {
  return (
    <div className={s.layout}>
      <nav className={s.nav} aria-label="Setup steps">
        <ProgressBar progress={progress} />
        <ol className={s.steps}>
          {progress.steps.map((step) => (
            <li key={step.key}>
              <Link
                href={`/app/onboarding/${step.number}`}
                className={`${s.stepLink} ${step.available ? "" : s.stepLater}`}
                aria-current={step.number === current ? "step" : undefined}
              >
                <span className={`${s.stepDot} ${step.done ? s.stepDone : ""}`} aria-hidden="true">
                  {step.done ? "✓" : step.number}
                </span>
                <span>
                  {step.title}
                  {step.done ? <span className="visually-hidden"> (done)</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <section className={s.card}>{children}</section>
    </div>
  );
}
