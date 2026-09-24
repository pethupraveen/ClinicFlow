import { CheckCheck } from "lucide-react";
import s from "../landing.module.css";

export type ChatItem =
  | { kind: "bot"; text: string; time: string }
  | { kind: "patient"; text: string; time: string }
  | { kind: "buttons"; options: string[]; chosen?: string; inline?: boolean }
  | { kind: "divider"; text: string };

/** Static WhatsApp-style conversation. Pure HTML/CSS — no images, no JS. */
export function ChatMock({ items, clinicName }: { items: ChatItem[]; clinicName: string }) {
  return (
    <div className={s.phone}>
      <div className={s.phoneScreen}>
        <div className={s.chatHeader}>
          <div className={s.chatAvatar} aria-hidden="true">
            {clinicName.charAt(0)}
          </div>
          <div>
            <div className={s.chatTitle}>{clinicName}</div>
            <div className={s.chatStatus}>Business account</div>
          </div>
        </div>
        <div className={s.chatBody}>
          {items.map((item, i) => {
            switch (item.kind) {
              case "divider":
                return (
                  <div key={i} className={s.dateDivider}>
                    {item.text}
                  </div>
                );
              case "buttons":
                return (
                  <div
                    key={i}
                    className={`${s.replyButtons} ${item.inline ? s.replyButtonsInline : ""}`}
                    aria-label={`Options: ${item.options.join(", ")}`}
                  >
                    {item.options.map((option) => (
                      <span
                        key={option}
                        className={`${s.replyButton} ${option === item.chosen ? s.replyButtonChosen : ""}`}
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                );
              default:
                return (
                  <div key={i} className={`${s.msg} ${item.kind === "bot" ? s.msgIn : s.msgOut}`}>
                    <span className="visually-hidden">{item.kind === "bot" ? "Clinic:" : "Patient:"} </span>
                    {item.text}
                    <span className={s.msgTime} aria-hidden="true">
                      {item.time}
                      {item.kind === "patient" && <CheckCheck />}
                    </span>
                  </div>
                );
            }
          })}
        </div>
      </div>
    </div>
  );
}

export const HERO_CHAT: ChatItem[] = [
  { kind: "bot", text: "👋 Welcome to SmileCare Dental Clinic.\nHow can I help you?", time: "9:41" },
  { kind: "buttons", options: ["Book Appointment", "Clinic Information", "Talk to Reception"], chosen: "Book Appointment" },
  { kind: "patient", text: "Book Appointment", time: "9:41" },
  { kind: "bot", text: "Available appointments with Dr. Arun, tomorrow:", time: "9:42" },
  { kind: "buttons", options: ["10:00 AM", "10:30 AM", "11:00 AM"], chosen: "10:30 AM", inline: true },
  { kind: "patient", text: "10:30 AM", time: "9:42" },
  { kind: "bot", text: "✅ Appointment booked successfully.\nAppointment ID: SC-1042", time: "9:42" },
];

export const FULL_CHAT: ChatItem[] = [
  { kind: "divider", text: "Today" },
  { kind: "patient", text: "Hi", time: "9:40" },
  { kind: "bot", text: "👋 Welcome to SmileCare Dental Clinic.\nHow can I help you?", time: "9:40" },
  { kind: "buttons", options: ["Book Appointment", "Clinic Information", "Talk to Reception"], chosen: "Book Appointment" },
  { kind: "bot", text: "Select a doctor:", time: "9:41" },
  { kind: "buttons", options: ["Dr. Arun", "Dr. Priya"], chosen: "Dr. Arun", inline: true },
  { kind: "bot", text: "Select a date:", time: "9:41" },
  { kind: "buttons", options: ["Today", "Tomorrow", "Friday"], chosen: "Tomorrow", inline: true },
  { kind: "bot", text: "Available appointments:", time: "9:41" },
  { kind: "buttons", options: ["10:00 AM", "10:30 AM", "11:00 AM"], chosen: "10:30 AM", inline: true },
  { kind: "bot", text: "Confirm your appointment?\n\nDr. Arun\nTomorrow\n10:30 AM", time: "9:42" },
  { kind: "buttons", options: ["Confirm"], chosen: "Confirm" },
  { kind: "bot", text: "✅ Appointment booked successfully.\nAppointment ID: SC-1042\n\nWe'll send you a reminder before your visit.", time: "9:42" },
];
