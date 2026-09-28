import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { ResetPasswordForm } from "@/modules/auth/components/AuthForms";
import s from "@/modules/auth/components/auth.module.css";
import { getSessionUser } from "@/modules/auth/guards";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the recovery link, which /auth/confirm turns into a session. */
export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <AuthShell title="Link expired" footer={<Link href="/login">Back to log in</Link>}>
        <p className={s.subtitle}>
          Your reset link has expired or was already used.{" "}
          <Link href="/forgot-password" className={s.inlineLink}>
            Request a new one
          </Link>
          .
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle={`For ${user.email}. You'll be signed out on other devices.`}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
