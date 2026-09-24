import Link from "next/link";
import { Check } from "lucide-react";
import { ROUTES } from "@/lib/site";
import {
  billingCycleLabel,
  formatPrice,
  getCatalogSettings,
  getPublicPlans,
  getTrialPlan,
} from "@/modules/subscriptions/plans";
import { planBullets } from "../planBullets";
import s from "../landing.module.css";

export function Pricing() {
  const plans = getPublicPlans();
  const { trialDays } = getTrialPlan();
  const { priceTaxNote } = getCatalogSettings();

  return (
    <section id="pricing" className={s.section} aria-labelledby="pricing-title">
      <div className={s.container}>
        <div className={`${s.sectionHead} ${s.sectionHeadCenter}`}>
          <span className={s.eyebrow}>Pricing</span>
          <h2 id="pricing-title" className={s.h2}>
            Simple monthly plans
          </h2>
          <p className={s.lead}>Every plan starts with a {trialDays}-day free trial. No credit card required.</p>
        </div>

        <ul className={s.plans}>
          {plans.map((plan) => (
            <li key={plan.code} className={`${s.plan} ${plan.display.popular ? s.planPopular : ""}`}>
              {plan.display.popular && <span className={s.popularTag}>Most popular</span>}
              <h3 className={s.planName}>{plan.name}</h3>
              {plan.display.tagline && <p className={s.planTagline}>{plan.display.tagline}</p>}
              <p className={s.planPrice}>
                <span className={s.planAmount}>{formatPrice(plan.pricePaise, plan.currency)}</span>
                <span className={s.planPer}>
                  / {billingCycleLabel(plan.billingCycle)} {priceTaxNote}
                </span>
              </p>
              <ul className={s.planList}>
                {planBullets(plan).map((bullet) => (
                  <li key={bullet}>
                    <Check aria-hidden="true" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <Link
                href={`${ROUTES.signup}?plan=${plan.code.toLowerCase()}`}
                className={`${s.btn} ${plan.display.popular ? s.btnPrimary : s.btnSecondary} ${s.btnBlock} ${s.planCta}`}
              >
                Start {trialDays}-Day Free Trial
              </Link>
            </li>
          ))}
        </ul>
        <p className={s.pricingNote}>
          A WhatsApp conversation is one patient chat within a 24-hour window.
        </p>
      </div>
    </section>
  );
}
