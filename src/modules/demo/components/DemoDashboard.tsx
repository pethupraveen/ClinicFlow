"use client";

import { useState, type KeyboardEvent } from "react";
import { MessageCircle } from "lucide-react";
import type { DateOption } from "../dates";
import {
  DEMO_APPOINTMENT_ID,
  DEMO_CLINIC_NAME,
  DEMO_PATIENT_NAME,
  OTHER_CONVERSATIONS,
  OTHER_PATIENTS,
  dashboardAppointments,
  doctorById,
  type DoctorId,
  type Slot,
} from "../fixtures";
import s from "../demo.module.css";

const TABS = [
  { id: "appointments", label: "Appointments" },
  { id: "patients", label: "Patients" },
  { id: "conversations", label: "WhatsApp conversations" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export interface DemoBooking {
  doctorId: DoctorId;
  slot: Slot;
  date: DateOption;
}

/** Simulated clinic dashboard. Pure fixture data; nothing is fetched. */
export function DemoDashboard({ booking }: { booking: DemoBooking | null }) {
  const [tab, setTab] = useState<TabId>("appointments");
  const rows = dashboardAppointments(booking);
  const viaWhatsApp = rows.filter((r) => r.via === "WhatsApp").length;
  const doctor = booking ? doctorById(booking.doctorId) : null;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    document.getElementById(`demo-tab-${next.id}`)?.focus();
  };

  return (
    <div className={s.dash}>
      <div className={s.dashTop}>
        <span className={s.dashClinic}>{DEMO_CLINIC_NAME}</span>
        <span className={`${s.badge} ${s.badgeWarn}`}>Demo · sample data</span>
      </div>

      <div className={s.tabs} role="tablist" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`demo-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`demo-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={s.tab}
            onClick={() => setTab(t.id)}
            onKeyDown={onTabKey}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`demo-panel-${tab}`} role="tabpanel" aria-labelledby={`demo-tab-${tab}`}>
        {tab === "appointments" && (
          <>
            <div className={s.stats}>
              <div className={s.stat}>
                <div className={s.statValue}>{rows.length}</div>
                <div className={s.statLabel}>Appointments</div>
              </div>
              <div className={s.stat}>
                <div className={s.statValue}>{viaWhatsApp}</div>
                <div className={s.statLabel}>Booked on WhatsApp</div>
              </div>
              <div className={s.stat}>
                <div className={s.statValue}>1</div>
                <div className={s.statLabel}>Waiting for reception</div>
              </div>
            </div>
            <p className={s.listHead}>
              {booking ? `${booking.date.label}'s appointments ` : "Upcoming appointments "}
              <span>{booking ? `· ${booking.date.display}` : ""}</span>
            </p>
            <ul aria-live="polite">
              {rows.map((r) => (
                <li key={`${r.time}-${r.patient}`} className={`${s.row} ${r.isNew ? s.rowNew : ""}`}>
                  <span className={s.time}>{r.time}</span>
                  <span className={s.who}>
                    <span className={s.name}>
                      {r.patient}
                      {r.isNew && <span className={`${s.badge} ${s.badgeNew}`}>New</span>}
                    </span>
                    <span className={s.meta}>
                      {r.doctor} · {r.via}
                      {r.isNew && ` · ${DEMO_APPOINTMENT_ID}`}
                    </span>
                  </span>
                  <span className={`${s.badge} ${s.badgeOk}`}>Confirmed</span>
                </li>
              ))}
            </ul>
            {!booking && (
              <p className={s.hint}>
                <MessageCircle aria-hidden="true" />
                Book an appointment in the chat. It will appear here automatically.
              </p>
            )}
          </>
        )}

        {tab === "patients" && (
          <ul>
            {booking && (
              <li className={`${s.row} ${s.rowPlain} ${s.rowNew}`}>
                <span className={s.who}>
                  <span className={s.name}>
                    {DEMO_PATIENT_NAME}
                    <span className={`${s.badge} ${s.badgeNew}`}>New</span>
                  </span>
                  <span className={s.meta}>Added automatically from WhatsApp</span>
                </span>
                <span className={`${s.badge} ${s.badgeOk}`}>1 upcoming</span>
              </li>
            )}
            {OTHER_PATIENTS.map((p) => (
              <li key={p.name} className={`${s.row} ${s.rowPlain}`}>
                <span className={s.who}>
                  <span className={s.name}>{p.name}</span>
                  <span className={s.meta}>{p.detail}</span>
                </span>
                <span className={`${s.badge} ${s.badgeMuted}`}>Patient</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "conversations" && (
          <ul>
            {booking && doctor && (
              <li className={`${s.row} ${s.rowPlain} ${s.rowNew}`}>
                <span className={s.who}>
                  <span className={s.name}>
                    {DEMO_PATIENT_NAME}
                    <span className={`${s.badge} ${s.badgeNew}`}>New</span>
                  </span>
                  <span className={s.meta}>
                    Booked {booking.slot} with {doctor.label}, {booking.date.label.toLowerCase()}
                  </span>
                </span>
                <span className={`${s.badge} ${s.badgeOk}`}>Handled by assistant</span>
              </li>
            )}
            {OTHER_CONVERSATIONS.map((c) => (
              <li key={c.name} className={`${s.row} ${s.rowPlain}`}>
                <span className={s.who}>
                  <span className={s.name}>{c.name}</span>
                  <span className={s.meta}>{c.preview}</span>
                </span>
                <span className={`${s.badge} ${c.status === "Waiting for reception" ? s.badgeWarn : s.badgeOk}`}>
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
