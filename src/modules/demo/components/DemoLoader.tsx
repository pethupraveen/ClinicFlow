"use client";

import dynamic from "next/dynamic";
import s from "../demo.module.css";

/**
 * The demo runs only in the browser: its state lives in memory and
 * sessionStorage, and it never talks to the server.
 */
const DemoApp = dynamic(() => import("./DemoApp"), {
  ssr: false,
  loading: () => (
    <div className={s.stage}>
      <div className={s.chat} aria-busy="true" aria-label="Loading demo" />
    </div>
  ),
});

export function DemoLoader({ trialDays }: { trialDays: number }) {
  return <DemoApp trialDays={trialDays} />;
}
