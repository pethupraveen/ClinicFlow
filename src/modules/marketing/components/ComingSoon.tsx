import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/lib/site";
import { LogoMark } from "./Sections";
import s from "../landing.module.css";

/** Temporary target for CTAs whose feature ships in a later phase. */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <main className={`${s.section} ${s.container}`} style={{ maxWidth: 560, textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <LogoMark />
      </div>
      <h1 className={s.h2}>{title}</h1>
      <p className={s.lead}>{body}</p>
      <div className={s.ctaRow} style={{ justifyContent: "center" }}>
        <Link href={ROUTES.home} className={`${s.btn} ${s.btnSecondary}`}>
          <ArrowLeft aria-hidden="true" size={18} />
          Back to home
        </Link>
      </div>
    </main>
  );
}
