import type { Metadata } from "next";
import authStyles from "@/modules/auth/components/auth.module.css";
import s from "@/modules/onboarding/components/onboarding.module.css";
import { requireStaff } from "@/modules/platform/staff";
import { closeRequestAction, disconnectNumberAction } from "@/modules/whatsapp/actions";
import { ConnectNumberForm } from "@/modules/whatsapp/components/WaForms";
import { sharedNumber, staffOverview } from "@/modules/whatsapp/store";

export const metadata: Metadata = { title: "WhatsApp numbers" };

const when = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function PlatformWhatsAppPage() {
  await requireStaff();
  const { requests, connections } = await staffOverview();
  const shared = sharedNumber();

  return (
    <>
      <section className={authStyles.panel}>
        <h1 className={authStyles.title}>WhatsApp numbers</h1>
        <p className={authStyles.subtitle}>
          Shared number: {shared ? `+${shared.displayNumber}` : "not configured (set the WHATSAPP_SHARED_* variables)"}
        </p>
      </section>

      <section className={authStyles.panel}>
        <h2 className={authStyles.title} style={{ fontSize: 20 }}>
          Open setup requests ({requests.length})
        </h2>
        {requests.length === 0 ? <p className={authStyles.subtitle}>No open requests.</p> : null}
        <div className={s.row} style={{ marginTop: 12 }}>
          {requests.map((r) => (
            <div key={r.businessPublicId} className={s.item}>
              <div className={s.itemHead}>
                <strong>{r.clinicName}</strong>
                <span className={s.muted}>
                  {r.businessPublicId} · requested {when(r.createdAt)}
                </span>
              </div>
              <p>
                Call <strong>{r.contactPhone}</strong>
                {r.preferredTime ? ` (${r.preferredTime})` : ""}. Clinic phone: {r.clinicPhone || "—"}
              </p>
              {r.note ? <p className={s.muted}>“{r.note}”</p> : null}
              <ConnectNumberForm clinic={r.businessPublicId} />
              <form action={closeRequestAction}>
                <input type="hidden" name="clinic" value={r.businessPublicId} />
                <button type="submit" className={s.danger}>
                  Close without connecting
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className={authStyles.panel}>
        <h2 className={authStyles.title} style={{ fontSize: 20 }}>
          Connected own numbers ({connections.length})
        </h2>
        <div className={s.row} style={{ marginTop: 12 }}>
          {connections.map((c) => (
            <div key={c.businessPublicId} className={s.item}>
              <div className={s.itemHead}>
                <strong>{c.clinicName}</strong>
                <span className={s.muted}>
                  +{c.displayPhone}
                  {c.verifiedName ? ` · ${c.verifiedName}` : ""} · since {when(c.connectedAt)}
                </span>
              </div>
              <details>
                <summary className={s.muted}>Replace token or number</summary>
                <ConnectNumberForm clinic={c.businessPublicId} />
              </details>
              <form action={disconnectNumberAction}>
                <input type="hidden" name="clinic" value={c.businessPublicId} />
                <button type="submit" className={s.danger}>
                  Disconnect (clinic falls back to the shared number)
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
