import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { ConfirmEmailForm } from "@/modules/auth/components/AuthForms";
import s from "@/modules/auth/components/auth.module.css";

export const metadata: Metadata = { title: "Confirm your email" };

/**
 * The emailed link lands here. Opening it does nothing by itself; the token
 * is spent only when the person presses Confirm, so mail scanners that
 * prefetch links cannot use it up.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <AuthShell title="Check your inbox" footer={<Link href="/app">Go to my clinic</Link>}>
        <p className={s.subtitle}>Open the link we emailed you to confirm your address.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Confirm your email" subtitle="Press the button to finish verifying your email address.">
      <ConfirmEmailForm token={token} />
    </AuthShell>
  );
}
