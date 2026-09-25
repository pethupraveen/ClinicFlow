"use client";

import { useCallback, useEffect, useRef } from "react";
import { startDemoAnalyticsSession, trackDemoEvent } from "./client";
import type { DemoEventName } from "./events";

/** Queues events until the HTTP-only demo session has been established. */
export function useDemoAnalytics(): (name: DemoEventName) => void {
  const ready = useRef(false);
  const enabled = useRef(false);
  const queued = useRef<DemoEventName[]>([]);

  useEffect(() => {
    let mounted = true;
    void startDemoAnalyticsSession().then((started) => {
      if (!mounted) return;
      enabled.current = started;
      ready.current = true;
      const pending = queued.current.splice(0);
      if (started) pending.forEach((name) => void trackDemoEvent(name));
    });
    return () => {
      mounted = false;
    };
  }, []);

  return useCallback((name: DemoEventName) => {
    if (!ready.current) {
      queued.current.push(name);
      return;
    }
    if (enabled.current) void trackDemoEvent(name);
  }, []);
}
