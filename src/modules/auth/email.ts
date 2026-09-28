import "server-only";

import { ENV, readEnv } from "@/lib/env";
import { SITE_NAME } from "@/lib/site";

export class EmailNotConfigured extends Error {
  constructor() {
    super("Email sending is not configured.");
  }
}

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Sends one transactional email through Resend's HTTP API. */
export async function sendEmail(email: Email): Promise<void> {
  const apiKey = readEnv(ENV.resendApiKey);
  if (!apiKey) throw new EmailNotConfigured();
  const from = readEnv(ENV.emailFrom) ?? `${SITE_NAME} <onboarding@resend.dev>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Resend rejected the email (${response.status}).`);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function verificationEmail(input: { to: string; name: string; link: string }): Email {
  const name = escapeHtml(input.name);
  const link = escapeHtml(input.link);
  return {
    to: input.to,
    subject: `Confirm your email for ${SITE_NAME}`,
    text: `Hi ${input.name},\n\nConfirm your email address to finish setting up your clinic on ${SITE_NAME}:\n${input.link}\n\nThe link works for 48 hours. If you didn't sign up, ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#11201b;max-width:480px">
<p>Hi ${name},</p>
<p>Confirm your email address to finish setting up your clinic on ${SITE_NAME}.</p>
<p><a href="${link}" style="display:inline-block;background:#0b6e4f;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Confirm email</a></p>
<p style="color:#5b6964;font-size:13px">The link works for 48 hours. If you didn't sign up, ignore this email.</p>
</div>`,
  };
}
