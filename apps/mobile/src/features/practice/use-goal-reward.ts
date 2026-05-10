import { useEffect, useRef, useState } from "react";

type UseGoalRewardInput = {
  /** Total seconds spoken today INCLUDING the in-flight session. */
  todaySeconds: number;
  /** Goal in seconds. */
  goalSeconds: number;
  /** Whether the backend already marked today's goal as reached on a previous session. */
  alreadyReachedToday: boolean;
};

/**
 * Detects the moment todaySeconds first crosses goalSeconds in this session,
 * subject to alreadyReachedToday guard. Fires `triggered` exactly once.
 */
export function useGoalReward(input: UseGoalRewardInput) {
  const [triggered, setTriggered] = useState(false);
  const firedRef = useRef(false);
  const prevSecondsRef = useRef(input.todaySeconds);

  useEffect(() => {
    if (firedRef.current) return;
    if (input.alreadyReachedToday) return;
    if (input.goalSeconds <= 0) return;

    const prev = prevSecondsRef.current;
    const now = input.todaySeconds;
    if (prev < input.goalSeconds && now >= input.goalSeconds) {
      firedRef.current = true;
      setTriggered(true);
    }
    prevSecondsRef.current = now;
  }, [input.todaySeconds, input.goalSeconds, input.alreadyReachedToday]);

  function dismiss() {
    setTriggered(false);
  }

  return { triggered, dismiss };
}
