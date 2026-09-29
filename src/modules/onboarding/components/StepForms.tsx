"use client";

import { useActionState, useRef } from "react";
import authStyles from "@/modules/auth/components/auth.module.css";
import { Field, FormMessages } from "@/modules/auth/components/Field";
import {
  addDoctorAction,
  addFaqAction,
  saveClinicInfoAction,
  saveHoursAction,
  updateDoctorAction,
  type StepFormState,
} from "../actions";
import { APPOINTMENT_LENGTHS, MAX_RANGES_PER_DAY, WEEKDAYS, type HoursRange } from "../schedule";
import type { ClinicInfo } from "../store";
import s from "./onboarding.module.css";

const initial: StepFormState = {};

function Buttons({ pending, primary }: { pending: boolean; primary: string }) {
  return (
    <div className={s.actions}>
      <button type="submit" name="intent" value="next" className={authStyles.submit} style={{ padding: "0 18px" }} disabled={pending}>
        {pending ? "Saving…" : primary}
      </button>
      <button type="submit" name="intent" value="later" className={s.secondary} disabled={pending}>
        Save and continue later
      </button>
    </div>
  );
}

export function ClinicInfoForm({ info }: { info: ClinicInfo }) {
  const [state, action, pending] = useActionState(saveClinicInfoAction, initial);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? info;
  return (
    <form action={action} className={s.row} noValidate>
      <FormMessages formError={state.formError} />
      <Field label="Clinic name" name="name" required maxLength={120} autoComplete="organization" defaultValue={v.name} error={e.name} />
      <Field
        label="Reception phone number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        maxLength={20}
        hint="Patients are given this number when they need to call."
        defaultValue={v.phone}
        error={e.phone}
      />
      <Field label="Address" name="address" required maxLength={300} autoComplete="street-address" defaultValue={v.address} error={e.address} />
      <Field label="City" name="city" required maxLength={80} autoComplete="address-level2" defaultValue={v.city} error={e.city} />
      <Field
        label="Google Maps link (optional)"
        name="mapsUrl"
        type="url"
        inputMode="url"
        maxLength={500}
        hint="In Google Maps, open your clinic → Share → Copy link."
        defaultValue={v.mapsUrl}
        error={e.mapsUrl}
      />
      <Buttons pending={pending} primary="Save and continue" />
    </form>
  );
}

function LengthSelect({ idPrefix, value, error }: { idPrefix: string; value?: string; error?: string }) {
  return (
    <div className={authStyles.field}>
      <label className={authStyles.label} htmlFor={`${idPrefix}-appointmentMinutes`}>
        Appointment length
      </label>
      <select id={`${idPrefix}-appointmentMinutes`} name="appointmentMinutes" className={s.select} defaultValue={value ?? "15"}>
        {APPOINTMENT_LENGTHS.map((m) => (
          <option key={m} value={m}>
            {m} minutes
          </option>
        ))}
      </select>
      {error ? <span className={authStyles.error}>{error}</span> : null}
    </div>
  );
}

/** Adds a doctor, or edits one when `doctor` is given. */
export function DoctorForm({ doctor }: { doctor?: { publicId: string; name: string; specialty: string; appointmentMinutes: number } }) {
  const [state, action, pending] = useActionState(doctor ? updateDoctorAction : addDoctorAction, initial);
  const idPrefix = doctor ? `doctor-${doctor.publicId}` : "new-doctor";
  const e = state.fieldErrors ?? {};
  const v = state.values ?? (doctor ? { name: doctor.name, specialty: doctor.specialty, appointmentMinutes: String(doctor.appointmentMinutes) } : {});
  return (
    // An add-form remounts empty after each successful save.
    <form action={action} key={doctor ? undefined : state.savedAt} className={s.row} noValidate>
      <FormMessages formError={state.formError} message={state.message} />
      {doctor ? <input type="hidden" name="doctor" value={doctor.publicId} /> : null}
      <div className={`${s.row} ${s.row3}`}>
        <Field idPrefix={idPrefix} label="Doctor's name" name="name" required maxLength={100} placeholder="Dr. Priya Sharma" defaultValue={v.name} error={e.name} />
        <Field idPrefix={idPrefix} label="Specialty" name="specialty" maxLength={80} placeholder="Dentist" defaultValue={v.specialty} error={e.specialty} />
        <LengthSelect idPrefix={idPrefix} value={v.appointmentMinutes} error={e.appointmentMinutes} />
      </div>
      <div className={s.actions}>
        <button type="submit" className={doctor ? s.secondary : authStyles.submit} style={{ padding: "0 18px" }} disabled={pending}>
          {pending ? "Saving…" : doctor ? "Save changes" : "Add doctor"}
        </button>
      </div>
    </form>
  );
}

export function ScheduleEditor({ doctorId, appointmentMinutes, hours }: { doctorId: string; appointmentMinutes: number; hours: HoursRange[] }) {
  const [state, action, pending] = useActionState(saveHoursAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const copyMonday = () => {
    const form = formRef.current;
    if (!form) return;
    const el = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;
    for (let day = 2; day <= 7; day++) {
      const on = el(`day-${day}-on`);
      if (on) on.checked = el("day-1-on")?.checked ?? false;
      for (let r = 1; r <= MAX_RANGES_PER_DAY; r++) {
        for (const part of ["start", "end"]) {
          const target = el(`day-${day}-${r}-${part}`);
          if (target) target.value = el(`day-1-${r}-${part}`)?.value ?? "";
        }
      }
    }
  };

  return (
    <form action={action} ref={formRef} className={s.row} key={doctorId}>
      <FormMessages formError={state.formError} message={state.message} />
      <input type="hidden" name="doctor" value={doctorId} />
      <p className={s.muted}>
        Tick the days this doctor sees patients. Add a second time range for a break, e.g. 10:00–13:00 and 17:00–20:00.
        Appointments are {appointmentMinutes} minutes long.
      </p>
      <div>
        {WEEKDAYS.map(({ day, label }) => {
          const ranges = hours.filter((h) => h.weekday === day);
          const error = state.dayErrors?.[day];
          return (
            <div key={day} className={s.day}>
              <label className={s.dayHead}>
                <input type="checkbox" name={`day-${day}-on`} defaultChecked={ranges.length > 0} />
                {label}
              </label>
              <div className={s.ranges}>
                {Array.from({ length: MAX_RANGES_PER_DAY }, (_, i) => (
                  <span key={i}>
                    <input
                      type="time"
                      step={300}
                      className={s.time}
                      name={`day-${day}-${i + 1}-start`}
                      aria-label={`${label} range ${i + 1} start`}
                      defaultValue={ranges[i]?.start ?? (i === 0 ? "10:00" : "")}
                    />
                    {" – "}
                    <input
                      type="time"
                      step={300}
                      className={s.time}
                      name={`day-${day}-${i + 1}-end`}
                      aria-label={`${label} range ${i + 1} end`}
                      defaultValue={ranges[i]?.end ?? (i === 0 ? "13:00" : "")}
                    />
                  </span>
                ))}
              </div>
              {error ? (
                <span className={authStyles.error} role="alert">
                  {error}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className={s.actions}>
        <button type="submit" className={authStyles.submit} style={{ padding: "0 18px" }} disabled={pending}>
          {pending ? "Saving…" : "Save working hours"}
        </button>
        <button type="button" className={s.secondary} onClick={copyMonday}>
          Copy Monday to all days
        </button>
      </div>
    </form>
  );
}

const FAQ_STARTERS = [
  { question: "What is the consultation fee?", answer: "" },
  { question: "Is parking available?", answer: "" },
  { question: "What are your clinic timings?", answer: "" },
  { question: "Do you accept walk-ins?", answer: "" },
];

export function FaqForm() {
  const [state, action, pending] = useActionState(addFaqAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.fieldErrors ?? {};
  const fill = (question: string) => {
    const q = formRef.current?.elements.namedItem("question") as HTMLInputElement | null;
    if (q) q.value = question;
    (formRef.current?.elements.namedItem("answer") as HTMLTextAreaElement | null)?.focus();
  };
  return (
    <form ref={formRef} action={action} key={state.savedAt} className={s.row} noValidate>
      <FormMessages formError={state.formError} message={state.message} />
      <div className={s.chips}>
        {FAQ_STARTERS.map((starter) => (
          <button key={starter.question} type="button" className={s.chip} onClick={() => fill(starter.question)}>
            + {starter.question}
          </button>
        ))}
      </div>
      <Field label="Question" name="question" required maxLength={200} defaultValue={state.values?.question} error={e.question} />
      <div className={authStyles.field}>
        <label className={authStyles.label} htmlFor="field-answer">
          Answer
        </label>
        <textarea id="field-answer" name="answer" className={s.textarea} maxLength={1000} defaultValue={state.values?.answer} />
        {e.answer ? <span className={authStyles.error}>{e.answer}</span> : null}
      </div>
      <div className={s.actions}>
        <button type="submit" className={authStyles.submit} style={{ padding: "0 18px" }} disabled={pending}>
          {pending ? "Adding…" : "Add question"}
        </button>
      </div>
    </form>
  );
}
