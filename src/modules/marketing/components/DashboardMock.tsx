import s from "../landing.module.css";

type Status = "Confirmed" | "Cancelled";

const ROWS: Array<{ time: string; name: string; doctor: string; via: string; status: Status; isNew?: boolean }> = [
  { time: "9:30 AM", name: "Meena S.", doctor: "Dr. Arun", via: "WhatsApp", status: "Confirmed" },
  { time: "10:00 AM", name: "Ravi Kumar", doctor: "Dr. Priya", via: "Phone call", status: "Confirmed" },
  { time: "10:30 AM", name: "Anitha R.", doctor: "Dr. Arun", via: "WhatsApp", status: "Confirmed", isNew: true },
  { time: "11:00 AM", name: "Joseph M.", doctor: "Dr. Arun", via: "WhatsApp", status: "Confirmed" },
  { time: "11:30 AM", name: "Farhan A.", doctor: "Dr. Priya", via: "WhatsApp", status: "Cancelled" },
];

const BADGE: Record<Status, string> = {
  Confirmed: s.badgeOk,
  Cancelled: s.badgeCancel,
};

/** Static illustration of the clinic dashboard. */
export function DashboardMock() {
  return (
    <div className={s.dash}>
      <div className={s.dashTop}>
        <span className={s.dashClinic}>SmileCare Dental Clinic</span>
        <span className={`${s.badge} ${s.badgeOk}`}>WhatsApp connected</span>
      </div>
      <div className={s.dashTabs} aria-hidden="true">
        <span className={`${s.dashTab} ${s.dashTabActive}`}>Appointments</span>
        <span className={s.dashTab}>Patients</span>
        <span className={s.dashTab}>WhatsApp conversations</span>
      </div>
      <div className={s.dashStats}>
        <div className={s.stat}>
          <div className={s.statValue}>14</div>
          <div className={s.statLabel}>Appointments</div>
        </div>
        <div className={s.stat}>
          <div className={s.statValue}>9</div>
          <div className={s.statLabel}>Booked on WhatsApp</div>
        </div>
        <div className={s.stat}>
          <div className={s.statValue}>1</div>
          <div className={s.statLabel}>Waiting for reception</div>
        </div>
      </div>
      <div className={s.dashListHead}>
        <span>Appointments</span>
        <span className={s.dayToggle} aria-hidden="true">
          <span>Today</span>
          <span className={s.dayActive}>Tomorrow</span>
        </span>
      </div>
      <ul>
        {ROWS.map((row) => (
          <li key={row.time} className={`${s.appt} ${row.isNew ? s.apptNew : ""}`}>
            <span className={s.apptTime}>{row.time}</span>
            <span className={s.apptWho}>
              <span className={s.apptName}>
                {row.name}
                {row.isNew && <span className={`${s.badge} ${s.badgeNew}`}>Just booked</span>}
              </span>
              <span className={s.apptMeta}>
                {row.doctor} · {row.via}
              </span>
            </span>
            <span className={`${s.badge} ${BADGE[row.status]}`}>{row.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
