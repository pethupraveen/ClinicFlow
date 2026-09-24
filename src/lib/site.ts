import { getTrialPlan } from "@/modules/subscriptions/plans";

/**
 * Public site settings. Set NEXT_PUBLIC_SITE_URL to the production origin
 * (e.g. https://clinicflow.in) — it drives canonical URLs, Open Graph and the
 * sitemap.
 */
export const SITE_NAME = "ClinicFlow WhatsApp";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const SITE_TITLE = "WhatsApp Appointment Booking for Clinics";

export const SITE_DESCRIPTION = `Let patients book appointments, check availability and get clinic information through WhatsApp. Try the live demo, then start a ${getTrialPlan().trialDays}-day free trial — no credit card required.`;

export const ROUTES = {
  home: "/",
  demo: "/demo",
  signup: "/signup",
} as const;
