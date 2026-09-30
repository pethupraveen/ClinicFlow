import QRCode from "qrcode";
import authStyles from "@/modules/auth/components/auth.module.css";
import s from "@/modules/onboarding/components/onboarding.module.css";
import type { Progress } from "@/modules/onboarding/steps";
import { goLiveAction, pauseAction } from "../actions";
import type { ClinicWhatsApp } from "../store";
import { RequestOwnNumberForm } from "./WaForms";

function formatNumber(digits: string): string {
  return `+${digits.replace(/\D/g, "")}`;
}

/** Step 5: the clinic's WhatsApp link and QR, and the "own number" request. */
export async function WhatsAppStep({ wa }: { wa: ClinicWhatsApp }) {
  if (!wa.link || !wa.number) {
    return (
      <p className={authStyles.warn}>
        WhatsApp isn&apos;t switched on for ClinicFlow yet. We&apos;ll let you know as soon as your clinic&apos;s link is
        ready — you can still finish the other steps.
      </p>
    );
  }
  const qr = await QRCode.toString(wa.link, { type: "svg", margin: 1, width: 240, errorCorrectionLevel: "M" });
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`;

  return (
    <>
      <p className={s.muted}>
        {wa.own
          ? `Patients message your clinic's own WhatsApp number, ${formatNumber(wa.own.displayPhone)}.`
          : "Your clinic is ready on WhatsApp right away. Share this link or QR code with patients — it opens a chat with your bot."}
      </p>
      <div className={s.item}>
        <div className={s.itemHead}>
          <strong>Your WhatsApp booking link</strong>
          {wa.own ? null : <span className={s.muted}>Clinic code {wa.code}</span>}
        </div>
        <a href={wa.link} className={authStyles.inlineLink} style={{ overflowWrap: "anywhere" }}>
          {wa.link}
        </a>
        {/* eslint-disable-next-line @next/next/no-img-element -- inline data URI, nothing to optimise */}
        <img src={qrSrc} width={240} height={240} alt={`QR code that opens a WhatsApp chat with ${formatNumber(wa.number)}`} />
        <div className={s.actions}>
          <a href={qrSrc} download={`clinicflow-whatsapp-${wa.code}.svg`} className={s.secondary}>
            Download QR code
          </a>
        </div>
        <p className={s.muted}>
          Put the QR at reception, on your Google profile or WhatsApp status. Your bot starts answering real patients once
          you go live in step 7.
        </p>
      </div>
      {wa.own ? null : (
        <div className={s.item}>
          <strong>Want patients to see your clinic&apos;s own number?</strong>
          {wa.openRequest ? (
            <p className={authStyles.notice} role="status">
              Request received — the ClinicFlow team will call {wa.openRequest.contactPhone}
              {wa.openRequest.preferredTime ? ` (${wa.openRequest.preferredTime})` : ""} to set it up for you.
            </p>
          ) : (
            <>
              <p className={s.muted}>
                Right now patients chat with the ClinicFlow number. Our team can connect your clinic&apos;s own WhatsApp
                number for you — no technical setup on your side.
              </p>
              <RequestOwnNumberForm />
            </>
          )}
        </div>
      )}
    </>
  );
}

const CHECKS: { label: string; done: (p: Progress, emailVerified: boolean) => boolean; step?: number }[] = [
  { label: "Clinic information", done: (p) => p.steps[0].done, step: 1 },
  { label: "A doctor with working hours", done: (p) => p.steps[2].done, step: 3 },
  { label: "Verified email", done: (_p, verified) => verified },
  { label: "WhatsApp link ready", done: (p) => p.steps[4].done, step: 5 },
];

/** Step 7: server-checked readiness list, Go live, and Pause/Resume. */
export function GoLiveStep({ wa, progress, emailVerified }: { wa: ClinicWhatsApp; progress: Progress; emailVerified: boolean }) {
  const ready = progress.mandatoryDone === progress.mandatoryTotal;
  return (
    <>
      <ul className={s.row} style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {CHECKS.map((c) => {
          const done = c.done(progress, emailVerified);
          return (
            <li key={c.label}>
              {done ? "✅" : "⬜"} {c.label}
              {!done && c.step ? (
                <>
                  {" — "}
                  <a href={`/app/onboarding/${c.step}`} className={authStyles.inlineLink}>
                    finish step {c.step}
                  </a>
                </>
              ) : null}
            </li>
          );
        })}
        <li className={s.muted}>
          {progress.steps[5].done ? "✅" : "💡"} Test your bot (recommended, not required)
        </li>
      </ul>
      {wa.lifecycle === "LIVE" ? (
        <>
          <p className={authStyles.notice} role="status">
            🟢 Your bot is live on WhatsApp{wa.wentLiveAt ? ` since ${wa.wentLiveAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : ""}. Real patients can book now.
          </p>
          <form action={pauseAction}>
            <button type="submit" className={s.secondary}>
              Pause bot
            </button>
          </form>
        </>
      ) : (
        <>
          {wa.lifecycle === "PAUSED" ? (
            <p className={authStyles.warn} role="status">
              ⏸ Your bot is paused. Patients who message get a polite note with your phone number.
            </p>
          ) : null}
          <form action={goLiveAction}>
            <button type="submit" className={authStyles.submit} style={{ padding: "0 22px" }} disabled={!ready}>
              {wa.lifecycle === "PAUSED" ? "Resume bot" : "Go live"}
            </button>
          </form>
          {ready ? null : <p className={s.muted}>Finish the items above to go live.</p>}
        </>
      )}
    </>
  );
}
