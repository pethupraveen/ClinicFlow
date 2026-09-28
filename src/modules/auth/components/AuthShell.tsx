import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import { LogoMark } from "@/modules/marketing/components/Sections";
import s from "./auth.module.css";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className={s.page}>
      <div className={s.card}>
        <Link href="/" className={s.brand}>
          <LogoMark />
          {SITE_NAME}
        </Link>
        <h1 className={s.title}>{title}</h1>
        {subtitle ? <p className={s.subtitle}>{subtitle}</p> : null}
        {children}
        {footer ? <p className={s.footer}>{footer}</p> : null}
      </div>
    </main>
  );
}
