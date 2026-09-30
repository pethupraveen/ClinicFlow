"use client";

import { useActionState } from "react";
import authStyles from "@/modules/auth/components/auth.module.css";
import { Field, FormMessages } from "@/modules/auth/components/Field";
import s from "@/modules/onboarding/components/onboarding.module.css";
import { connectNumberAction, requestOwnNumberAction, type WaFormState } from "../actions";

const initial: WaFormState = {};

export function RequestOwnNumberForm() {
  const [state, action, pending] = useActionState(requestOwnNumberAction, initial);
  if (state.message) return <FormMessages message={state.message} />;
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className={s.row} noValidate>
      <FormMessages formError={state.formError} />
      <div className={`${s.row} ${s.row2}`}>
        <Field idPrefix="wa" label="Phone number we can call" name="contactPhone" type="tel" inputMode="tel" required maxLength={20} defaultValue={state.values?.contactPhone} error={e.contactPhone} />
        <Field idPrefix="wa" label="Best time to call (optional)" name="preferredTime" maxLength={80} placeholder="Weekdays after 2 pm" defaultValue={state.values?.preferredTime} error={e.preferredTime} />
      </div>
      <Field idPrefix="wa" label="Note (optional)" name="note" maxLength={500} placeholder="e.g. the number we want to use" defaultValue={state.values?.note} error={e.note} />
      <div className={s.actions}>
        <button type="submit" className={authStyles.submit} style={{ padding: "0 18px" }} disabled={pending}>
          {pending ? "Sending…" : "Request a call"}
        </button>
      </div>
    </form>
  );
}

export function ConnectNumberForm({ clinic }: { clinic: string }) {
  const [state, action, pending] = useActionState(connectNumberAction, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className={s.row} noValidate>
      <FormMessages formError={state.formError} message={state.message} />
      <input type="hidden" name="clinic" value={clinic} />
      <div className={`${s.row} ${s.row2}`}>
        <Field idPrefix={`c-${clinic}`} label="Phone number ID" name="phoneNumberId" inputMode="numeric" required defaultValue={state.values?.phoneNumberId} error={e.phoneNumberId} />
        <Field idPrefix={`c-${clinic}`} label="Access token" name="token" type="password" autoComplete="off" required error={e.token} />
      </div>
      <div className={s.actions}>
        <button type="submit" className={s.secondary} disabled={pending}>
          {pending ? "Checking with Meta…" : "Connect number"}
        </button>
      </div>
    </form>
  );
}
