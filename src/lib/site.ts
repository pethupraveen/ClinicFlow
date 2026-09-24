import { getTrialPlan } from "@/modules/subscriptions/plans";

/**
 * Public site settings. SITE_URL drives canonical URLs, Open Graph and the
 * sitemap. Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — set this once a custom domain exists
 *   2. VERCEL_PROJECT_PRODUCTION_URL — set automatically on Vercel builds
 *   3. http://localhost:3000
 */
export const SITE_NAME = "ClinicFlow WhatsApp";

export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const url = explicit || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});

export const SITE_TITLE = "WhatsApp Appointment Booking for Clinics";

export const SITE_DESCRIPTION = `Let patients book appointments, check availability and get clinic information through WhatsApp. Try the live demo, then start a ${getTrialPlan().trialDays}-day free trial — no credit card required.`;

export const ROUTES = {
  home: "/",
  demo: "/demo",
  signup: "/signup",
  bookDemo: "/book-demo",
} as const;
