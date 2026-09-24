"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ROUTES } from "@/lib/site";
import ls from "@/modules/marketing/landing.module.css";
import { elapsedText } from "../machine";
import s from "../demo.module.css";

const TRIAL_HREF = `${ROUTES.signup}?from=demo`;

/** Shown once the visitor has seen the booking land in the dashboard. */
export function DemoConversion({
  trialDays,
  seconds,
  onClose,
  onRestart,
}: {
  trialDays: number;
  seconds: number | null;
  onClose: () => void;
  onRestart: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section className={s.sheet} role="dialog" aria-modal="false" aria-labelledby="demo-done-title">
      <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close and keep exploring">
        <X aria-hidden="true" />
      </button>
      <h2 id="demo-done-title" ref={titleRef} tabIndex={-1} className={s.sheetTitle}>
        ✅ You just booked an appointment through a WhatsApp receptionist.
      </h2>
      <p className={s.sheetText}>
        {elapsedText(seconds)} Your patients could book appointments the same way.
      </p>
      <p className={s.sheetAsk}>Want this for your clinic?</p>
      <div className={s.sheetActions}>
        <Link href={TRIAL_HREF} className={`${ls.btn} ${ls.btnPrimary}`}>
          Start My {trialDays}-Day Free Trial
        </Link>
        <Link href={ROUTES.bookDemo} className={`${ls.btn} ${ls.btnSecondary}`}>
          Book a Demo
        </Link>
        <button type="button" className={s.restart} onClick={onRestart}>
          Restart demo
        </button>
      </div>
      <p className={s.note}>{trialDays}-Day Free Trial • No Credit Card Required</p>
    </section>
  );
}

/** Inline version of the same CTAs, left in the dashboard after the sheet is closed. */
export function DemoConversionBanner({ trialDays, onRestart }: { trialDays: number; onRestart: () => void }) {
  return (
    <div className={s.banner}>
      <p>Want this for your clinic?</p>
      <div className={s.bannerActions}>
        <Link href={TRIAL_HREF} className={`${ls.btn} ${ls.btnSmall}`}>
          Start My {trialDays}-Day Free Trial
        </Link>
        <Link href={ROUTES.bookDemo} className={`${ls.btn} ${ls.btnSmall} ${s.bannerRestart}`}>
          Book a Demo
        </Link>
        <button type="button" className={`${s.restart} ${s.bannerRestart}`} onClick={onRestart}>
          Restart demo
        </button>
      </div>
    </div>
  );
}
