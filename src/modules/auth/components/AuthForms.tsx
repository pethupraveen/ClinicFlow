"use client";

import { useActionState } from "react";
import { createClinicAction, type FormState } from "../actions";
import s from "./auth.module.css";
import { Field, FormMessages } from "./Field";

export function WelcomeForm({ defaultName }: { defaultName?: string }) {
  const [state, action, pending] = useActionState(createClinicAction, {} as FormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className={s.form} noValidate>
      <FormMessages formError={state.formError} />
      <Field
        label="Your name"
        name="fullName"
        autoComplete="name"
        required
        maxLength={100}
        defaultValue={state.values?.fullName ?? defaultName}
        error={e.fullName}
      />
      <Field
        label="Clinic name"
        name="clinicName"
        autoComplete="organization"
        required
        maxLength={120}
        defaultValue={state.values?.clinicName}
        error={e.clinicName}
      />
      <button type="submit" className={s.submit} disabled={pending} aria-busy={pending}>
        {pending ? "Setting up your clinic…" : "Continue"}
      </button>
    </form>
  );
}
