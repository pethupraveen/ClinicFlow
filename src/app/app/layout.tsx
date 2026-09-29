import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { logoutAction } from "@/modules/auth/actions";
import s from "@/modules/auth/components/auth.module.css";
import { requireMember } from "@/modules/auth/guards";
import { LogoMark } from "@/modules/marketing/components/Sections";

export const metadata: Metadata = {
  title: "My clinic",
  robots: { index: false, follow: false },
};

// Always per request: every page here is personal, and the CSP nonce needs it.
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await connection();
  const { membership } = await requireMember("/app");
  return (
    <>
      <header className={s.appHeader}>
        <div className={s.appHeaderInner}>
          <Link href="/app" className={s.brand} style={{ marginBottom: 0 }}>
            <LogoMark />
            <span>{membership.business.name}</span>
          </Link>
          <form action={logoutAction}>
            <button type="submit" className={s.linkButton}>
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className={s.appMain}>{children}</main>
    </>
  );
}
