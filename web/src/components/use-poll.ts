"use client";

import { useEffect, useRef } from "react";

/**
 * Polls only while the tab is visible, and runs once immediately when it
 * becomes visible again so a backgrounded tab is never showing stale data.
 */
export function useVisiblePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const latest = useRef(callback);
  // Kept current in an effect so the interval always calls the latest closure
  // without the ref being written during render.
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      stop();
      timer = window.setInterval(() => void latest.current(), intervalMs);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void latest.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      // Run once up front so the first paint is not an empty interval away.
      void latest.current();
      start();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}

/** Delays a callback until the caller has stopped firing it for `delayMs`. */
export function useDebounced<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
) {
  const latest = useRef(callback);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  return (...args: Args) => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => latest.current(...args), delayMs);
  };
}
