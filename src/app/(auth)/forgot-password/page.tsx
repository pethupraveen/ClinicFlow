import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { ForgotPasswordForm } from "@/modules/auth/components/AuthForms";
import s from "@/modules/auth/components/auth.module.css";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const expired = (await searchParams).expired === "1";
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a link to choose a new password."
      footer={<Link href="/login">Back to log in</Link>}
    >
      {expired ? (
        <p className={s.alert} role="alert" style={{ marginTop: 16 }}>
          That reset link is invalid or has expired. Request a new one below.
        </p>
      ) : null}
      <ForgotPasswordForm />
    </AuthShell>
  );
}
