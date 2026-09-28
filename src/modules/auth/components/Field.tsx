import type { InputHTMLAttributes } from "react";
import s from "./auth.module.css";

export function Field({
  label,
  name,
  error,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string }) {
  const id = `field-${name}`;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={s.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {hint ? (
        <span id={`${id}-hint`} className={s.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className={s.error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function FormMessages({ formError, message }: { formError?: string; message?: string }) {
  return (
    <>
      {formError ? (
        <p className={s.alert} role="alert">
          {formError}
        </p>
      ) : null}
      {message ? (
        <p className={s.notice} role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}
