import { useEffect, useRef, useState } from "react";

/**
 * Counts seconds while `active` is true. Pauses when inactive.
 * Pure timer hook — no audio/state-machine awareness.
 */
export function useSessionTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  function reset() {
    setSeconds(0);
  }

  return { seconds, reset };
}
