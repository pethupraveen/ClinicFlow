import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { MarketingPageView } from "@/modules/analytics/components/MarketingPageView";
import { getPublicPlans, getTrialPlan } from "@/modules/subscriptions/plans";
import { getFaqs, type Faq } from "./content";
import { Pricing } from "./components/Pricing";
import { StickyCta } from "./components/StickyCta";
import {
  DemoBand,
  FaqSection,
  Features,
  FinalCta,
  Footer,
  Header,
  Hero,
  HowItWorks,
  Previews,
} from "./components/Sections";
import s from "./landing.module.css";

function structuredData(faqs: Faq[]) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: getPublicPlans().map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: (plan.pricePaise / 100).toFixed(2),
        priceCurrency: plan.currency,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];
}

export function LandingPage() {
  const { trialDays } = getTrialPlan();
  const faqs = getFaqs();

  return (
    <div className={s.page}>
      <MarketingPageView page="landing" />
      <script
        type="application/ld+json"
        // Escape "<" so no JSON string can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(faqs)).replace(/</g, "\\u003c") }}
      />
      <Header trialDays={trialDays} />
      <main>
        <Hero trialDays={trialDays} />
        <HowItWorks />
        <Features />
        <DemoBand />
        <Previews />
        <Pricing />
        <FaqSection faqs={faqs} />
        <FinalCta trialDays={trialDays} />
      </main>
      <Footer />
      <StickyCta trialDays={trialDays} />
    </div>
  );
}
