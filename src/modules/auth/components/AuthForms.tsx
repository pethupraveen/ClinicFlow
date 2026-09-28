"use client";

import { useActionState } from "react";
import {
  confirmEmailAction,
  forgotPasswordAction,
  loginAction,
  resendVerificationAction,
  resetPasswordAction,
  signupAction,
  type FormState,
} from "../actions";
import { PASSWORD_MIN_LENGTH } from "../passwordRules";
import s from "./auth.module.css";
import { Field, FormMessages } from "./Field";

const initial: FormState = {};

function Submit({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <button type="submit" className={s.submit} disabled={pending} aria-busy={pending}>
      {pending ? busy : idle}
    </button>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className={s.form} noValidate>
      <FormMessages formError={state.formError} />
      <Field label="Your name" name="fullName" autoComplete="name" required maxLength={100} defaultValue={state.values?.fullName} error={e.fullName} />
      <Field label="Clinic name" name="clinicName" autoComplete="organization" required maxLength={120} defaultValue={state.values?.clinicName} error={e.clinicName} />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} error={e.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={e.password}
      />
      <Submit pending={pending} idle="Create my clinic account" busy="Creating your account…" />
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className={s.form} noValidate>
      <FormMessages formError={state.formError} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} error={e.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={e.password} />
      <Submit pending={pending} idle="Log in" busy="Logging in…" />
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);
  if (state.message) return <FormMessages message={state.message} />;
  return (
    <form action={action} className={s.form} noValidate>
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <Submit pending={pending} idle="Send reset link" busy="Sending…" />
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className={s.form} noValidate>
      <FormMessages formError={state.formError} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={e.password}
      />
      <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required error={e.confirmPassword} />
      <Submit pending={pending} idle="Save new password" busy="Saving…" />
    </form>
  );
}

export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmEmailAction, initial);
  if (state.message) {
    return (
      <div className={s.form}>
        <FormMessages message={state.message} />
        <a href="/app" className={s.submit} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
          Go to my clinic
        </a>
      </div>
    );
  }
  return (
    <form action={action} className={s.form}>
      <FormMessages formError={state.formError} />
      <input type="hidden" name="token" value={token} />
      <Submit pending={pending} idle="Confirm my email" busy="Confirming…" />
    </form>
  );
}

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(resendVerificationAction, initial);
  if (state.message) return <span role="status">{state.message}</span>;
  return (
    <form action={action}>
      {state.formError ? <span role="alert">{state.formError} </span> : null}
      <button type="submit" className={s.linkButton} disabled={pending}>
        {pending ? "Sending…" : "Resend email"}
      </button>
    </form>
  );
}
