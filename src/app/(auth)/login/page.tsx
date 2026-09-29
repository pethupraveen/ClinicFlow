import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import s from "@/modules/auth/components/auth.module.css";
import { GoogleButton } from "@/modules/auth/components/GoogleButton";
import { getSessionUser } from "@/modules/auth/guards";
import { safeNextPath } from "@/modules/auth/redirects";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSessionUser()) redirect(next);
  return (
    <AuthShell
      title="Log in to your clinic"
      footer={
        <>
          New here? <Link href="/signup">Start a free trial</Link>
        </>
      }
    >
      {params.error === "google" ? (
        <p className={s.alert} role="alert" style={{ marginTop: 16 }}>
          Google sign-in didn&apos;t complete. Please try again.
        </p>
      ) : null}
      <GoogleButton next={next === "/app" ? undefined : next} />
    </AuthShell>
  );
}
