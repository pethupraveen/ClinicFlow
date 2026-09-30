import type { Metadata } from "next";
import { connection } from "next/server";
import authStyles from "@/modules/auth/components/auth.module.css";
import { requireStaff } from "@/modules/platform/staff";

export const metadata: Metadata = {
  title: "ClinicFlow staff",
  robots: { index: false, follow: false },
};

/** Staff-only area; non-staff get a 404 from requireStaff(). */
export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  await connection();
  const staff = await requireStaff();
  return (
    <>
      <header className={authStyles.appHeader}>
        <div className={authStyles.appHeaderInner}>
          <strong>ClinicFlow staff</strong>
          <span className={authStyles.subtitle} style={{ marginTop: 0 }}>
            {staff.email}
          </span>
        </div>
      </header>
      <main className={authStyles.appMain}>{children}</main>
    </>
  );
}
