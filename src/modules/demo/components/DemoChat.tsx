"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck } from "lucide-react";
import ws from "@/modules/marketing/landing.module.css";
import { DEMO_CLINIC_NAME, RECEPTIONIST_NAME } from "../fixtures";
import type { Message, Option } from "../machine";
import s from "../demo.module.css";

const TYPING_MS = 650;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * WhatsApp-style chat. Patient messages appear instantly; each bot/staff
 * message is preceded by a short typing indicator. Reply buttons show only
 * once every message is on screen.
 */
export function DemoChat({
  messages,
  options,
  onChoose,
  showDashboardButton,
  onShowDashboard,
}: {
  messages: Message[];
  options: Option[];
  onChoose: (optionId: string) => void;
  showDashboardButton: boolean;
  onShowDashboard: () => void;
}) {
  // Mounted with everything visible (fresh start or restored session).
  const [shown, setShown] = useState(messages.length);
  const logRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const tappedRef = useRef(false);

  const pending = shown < messages.length;
  const next = pending ? messages[shown] : undefined;
  const typing = next !== undefined && next.from !== "patient";

  useEffect(() => {
    if (!next) return;
    const delay = next.from === "patient" || prefersReducedMotion() ? 0 : TYPING_MS;
    const timer = setTimeout(() => setShown((n) => n + 1), delay);
    return () => clearTimeout(timer);
  }, [next]);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [shown, typing, options.length]);

  // After a tap, move focus to the new reply buttons (buttons that were tapped are removed).
  useEffect(() => {
    if (!pending && tappedRef.current) {
      tappedRef.current = false;
      firstOptionRef.current?.focus({ preventScroll: true });
    }
  }, [pending]);

  const choose = (id: string) => {
    tappedRef.current = true;
    onChoose(id);
  };

  return (
    <div className={s.chat}>
      <div className={ws.chatHeader}>
        <div className={ws.chatAvatar} aria-hidden="true">
          S
        </div>
        <div>
          <div className={ws.chatTitle}>{DEMO_CLINIC_NAME}</div>
          <div className={ws.chatStatus}>{typing ? "typing…" : "Business account"}</div>
        </div>
      </div>

      <div ref={logRef} className={s.log} role="log" aria-live="polite" aria-label="Demo WhatsApp conversation">
        {messages.slice(0, shown).map((m) => (
          <div key={m.id} className={`${ws.msg} ${m.from === "patient" ? ws.msgOut : ws.msgIn} ${s.msgEnter}`}>
            <span className="visually-hidden">
              {m.from === "patient" ? "You: " : m.from === "staff" ? "Reception: " : "Clinic: "}
            </span>
            {m.from === "staff" && (
              <span className={s.staffName} aria-hidden="true">
                {RECEPTIONIST_NAME} · Reception
              </span>
            )}
            {m.text}
            <span className={ws.msgTime} aria-hidden="true">
              now
              {m.from === "patient" && <CheckCheck />}
            </span>
          </div>
        ))}

        {typing && (
          <div className={s.typing} aria-label="Clinic is typing">
            <span />
            <span />
            <span />
          </div>
        )}

        {!pending && options.length > 0 && (
          <div
            role="group"
            aria-label="Reply options"
            className={`${ws.replyButtons} ${options.length > 1 && options.every((o) => o.label.length <= 10) ? ws.replyButtonsInline : ""}`}
          >
            {options.map((o, i) => (
              <button
                key={o.id}
                ref={i === 0 ? firstOptionRef : undefined}
                type="button"
                className={`${ws.replyButton} ${s.optionButton} ${s.msgEnter}`}
                onClick={() => choose(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {!pending && showDashboardButton && (
          <button
            type="button"
            ref={firstOptionRef}
            className={`${ws.replyButton} ${s.optionButton} ${s.seeDashboard} ${s.msgEnter}`}
            onClick={onShowDashboard}
          >
            See it in the clinic dashboard →
          </button>
        )}
      </div>

      <div className={s.composer} aria-hidden="true">
        <span className={s.composerField}>Tap a button above to reply</span>
      </div>
    </div>
  );
}
