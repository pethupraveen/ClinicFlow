import type { Metadata } from "next";
import Link from "next/link";
import authStyles from "@/modules/auth/components/auth.module.css";
import { requireMember } from "@/modules/auth/guards";
import c from "@/modules/bot/components/chat.module.css";
import { BOOKING_HORIZON_DAYS, formatDay, formatTime } from "@/modules/bot/slots";
import { clinicTimeZone, listAppointments } from "@/modules/bot/store";
import { localDate, startOfLocalDay } from "@/modules/trial/dates";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage() {
  const { membership } = await requireMember("/app/appointments");
  const businessId = membership.business.id;
  const timeZone = await clinicTimeZone(businessId);
  const now = new Date();
  const from = startOfLocalDay(localDate(now, timeZone), timeZone);
  const to = new Date(from.getTime() + (BOOKING_HORIZON_DAYS + 1) * 86_400_000);
  const appointments = await listAppointments(businessId, from, to);
  const dayOf = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

  return (
    <section className={authStyles.panel}>
      <h1 className={authStyles.title}>Appointments</h1>
      <p className={authStyles.subtitle}>Today and the next {BOOKING_HORIZON_DAYS} days.</p>
      {appointments.length === 0 ? (
        <p className={authStyles.subtitle} style={{ marginTop: 16 }}>
          No appointments yet.{" "}
          <Link href="/app/onboarding/6" className={authStyles.inlineLink}>
            Try booking one with your test chat
          </Link>
          .
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table className={c.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Patient</th>
                <th scope="col">Doctor</th>
                <th scope="col">Ref</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.ref} className={a.status === "CANCELLED" ? c.cancelled : undefined}>
                  <td>
                    {formatDay(dayOf(a.start), now, timeZone)}, {formatTime(a.start, timeZone)}
                  </td>
                  <td>
                    {a.patient} {a.isTest ? <span className={c.testTag}>TEST</span> : null}
                    {a.status === "CANCELLED" ? <span className="visually-hidden"> (cancelled)</span> : null}
                  </td>
                  <td>{a.doctor}</td>
                  <td>{a.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
