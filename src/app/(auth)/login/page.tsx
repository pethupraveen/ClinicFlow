import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { LoginForm } from "@/modules/auth/components/AuthForms";
import { getSessionUser } from "@/modules/auth/guards";
import { safeNextPath } from "@/modules/auth/redirects";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);
  if (await getSessionUser()) redirect(next);
  return (
    <AuthShell
      title="Log in to your clinic"
      footer={
        <>
          <Link href="/forgot-password">Forgot your password?</Link>
          <br />
          New here? <Link href="/signup">Start a free trial</Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
