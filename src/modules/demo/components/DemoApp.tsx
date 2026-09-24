"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import {
  STORAGE_KEY,
  hasBooking,
  initialState,
  optionsFor,
  parseStored,
  reduce,
  secondsToBook,
  type DemoEvent,
  type DemoState,
} from "../machine";
import { DemoChat } from "./DemoChat";
import { DemoConversion, DemoConversionBanner } from "./DemoConversion";
import { DemoDashboard, type DemoBooking } from "./DemoDashboard";
import s from "../demo.module.css";

/** Booked → Dashboard (plan: "auto after 1.5s", plus the typing indicator). */
const TO_DASHBOARD_MS = 2200;
/** Time to watch the new row land before the conversion sheet opens. */
const TO_CONVERSION_MS = 3000;

type View = "chat" | "dashboard";

function readStorage(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Private mode / blocked storage: the demo still works, it just won't survive a reload.
  }
}

/** Resume a demo from this tab after a reload (client-only component, so storage is readable). */
function restore(): DemoState {
  return parseStored(readStorage()) ?? initialState();
}

function viewFor(state: DemoState): View {
  return state.state === "dashboard" || state.state === "conversion" ? "dashboard" : "chat";
}

export default function DemoApp({ trialDays }: { trialDays: number }) {
  const [state, dispatch] = useReducer(reduce, undefined, restore);
  // Bumped on restart so the chat remounts cleanly.
  const [session, setSession] = useState(0);
  const [view, setView] = useState<View>(() => viewFor(state));
  const [sheetClosed, setSheetClosed] = useState(false);

  const send = useCallback((event: DemoEvent) => dispatch(event), []);

  const showDashboard = useCallback(() => {
    send({ type: "SHOW_DASHBOARD" });
    setView("dashboard");
  }, [send]);

  useEffect(() => {
    writeStorage(JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (state.state === "booked") {
      const t = setTimeout(showDashboard, TO_DASHBOARD_MS);
      return () => clearTimeout(t);
    }
    if (state.state === "dashboard") {
      const t = setTimeout(() => send({ type: "COMPLETE", now: Date.now() }), TO_CONVERSION_MS);
      return () => clearTimeout(t);
    }
  }, [state.state, send, showDashboard]);

  const restart = useCallback(() => {
    writeStorage(null);
    send({ type: "RESTART" });
    setSession((n) => n + 1);
    setSheetClosed(false);
    setView("chat");
  }, [send]);

  const closeSheet = useCallback(() => setSheetClosed(true), []);

  const dashboardLive = state.state === "dashboard" || state.state === "conversion";
  const booking: DemoBooking | null =
    dashboardLive && hasBooking(state) && state.doctorId && state.slot && state.date
      ? { doctorId: state.doctorId, slot: state.slot, date: state.date }
      : null;

  return (
    <>
      <div className={s.toggle} role="group" aria-label="Switch view">
        <button
          type="button"
          className={s.toggleButton}
          aria-pressed={view === "chat"}
          onClick={() => setView("chat")}
        >
          Patient&apos;s WhatsApp
        </button>
        <button
          type="button"
          className={s.toggleButton}
          aria-pressed={view === "dashboard"}
          onClick={() => setView("dashboard")}
        >
          Clinic dashboard
          {dashboardLive && view !== "dashboard" && <span className={s.dot} aria-label="(new booking)" />}
        </button>
      </div>

      <div className={s.stage}>
        <section className={view === "chat" ? undefined : s.paneHidden} aria-label="Patient's WhatsApp">
          <p className={s.paneLabel}>1 · What your patient sees</p>
          <DemoChat
            key={session}
            messages={state.messages}
            options={optionsFor(state)}
            onChoose={(option) => send({ type: "CHOOSE", option, now: Date.now() })}
            showDashboardButton={state.state === "booked"}
            onShowDashboard={showDashboard}
          />
        </section>

        <section className={view === "dashboard" ? undefined : s.paneHidden} aria-label="Clinic dashboard">
          <p className={s.paneLabel}>2 · What your clinic sees</p>
          <DemoDashboard booking={booking} />
          {state.state === "conversion" && sheetClosed && (
            <DemoConversionBanner trialDays={trialDays} onRestart={restart} />
          )}
        </section>
      </div>

      {state.state === "conversion" && !sheetClosed && (
        <DemoConversion trialDays={trialDays} seconds={secondsToBook(state)} onClose={closeSheet} onRestart={restart} />
      )}
    </>
  );
}
