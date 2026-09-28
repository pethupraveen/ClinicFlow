import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { logoutAction } from "@/modules/auth/actions";
import { ResendVerificationForm } from "@/modules/auth/components/AuthForms";
import s from "@/modules/auth/components/auth.module.css";
import { requireAppAccess } from "@/modules/auth/guards";
import { LogoMark } from "@/modules/marketing/components/Sections";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

export default async function AppHomePage({ searchParams }: PageProps<"/app">) {
  const access = await requireAppAccess("/app");
  const { reset } = await searchParams;

  const logout = (
    <form action={logoutAction}>
      <button type="submit" className={s.linkButton}>
        Log out
      </button>
    </form>
  );

  if (access.kind === "no-membership") {
    return (
      <main className={s.page}>
        <div className={s.card}>
          <h1 className={s.title}>We couldn&apos;t load your clinic</h1>
          <p className={s.subtitle}>
            Your account exists, but its clinic wasn&apos;t set up completely. Please contact support and we&apos;ll fix
            it for you.
          </p>
          <div style={{ marginTop: 16 }}>{logout}</div>
        </div>
      </main>
    );
  }

  const { membership, user } = access;
  return (
    <>
      <header className={s.appHeader}>
        <div className={s.appHeaderInner}>
          <Link href="/app" className={s.brand} style={{ marginBottom: 0 }}>
            <LogoMark />
            <span>{membership.business.name}</span>
          </Link>
          {logout}
        </div>
      </header>
      <main className={s.appMain}>
        {reset === "1" ? (
          <p className={s.notice} role="status">
            Your password was changed. Other devices have been signed out.
          </p>
        ) : null}
        {membership.emailVerified ? null : (
          <div className={s.warn}>
            <span>
              Please verify your email: we sent a link to <strong>{maskEmail(user.email)}</strong>.
            </span>
            <ResendVerificationForm />
          </div>
        )}
        <section className={s.panel}>
          <h1 className={s.title}>Welcome, {membership.fullName.split(" ")[0]}!</h1>
          <p className={s.subtitle}>
            Your {SITE_NAME} account for {membership.business.name} is ready. Clinic setup — doctors, schedules and your
            WhatsApp bot — arrives in the next steps.
          </p>
        </section>
      </main>
    </>
  );
}
