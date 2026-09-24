"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/site";
import s from "../landing.module.css";

/**
 * Phone-only bottom bar that appears once the hero's CTAs scroll away, so the
 * demo is always one thumb-tap away. Hidden again at the final CTA.
 */
export function StickyCta({ trialDays }: { trialDays: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const targets = ["hero-ctas", "final-cta"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!targets.length || !("IntersectionObserver" in window)) return;

    const onScreen = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) onScreen.set(entry.target, entry.isIntersecting);
      const anyCtaVisible = [...onScreen.values()].some(Boolean);
      // Show only after the visitor has scrolled past the hero.
      setVisible(!anyCtaVisible && window.scrollY > 200);
    });
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`${s.sticky} ${visible ? s.stickyVisible : ""}`} aria-hidden={!visible}>
      <div className={s.stickyInner}>
        <Link href={ROUTES.demo} className={`${s.btn} ${s.btnPrimary}`} tabIndex={visible ? 0 : -1}>
          Try Live Demo
        </Link>
        <Link href={ROUTES.signup} className={`${s.btn} ${s.btnSecondary}`} tabIndex={visible ? 0 : -1}>
          {trialDays}-Day Free Trial
        </Link>
      </div>
    </div>
  );
}
