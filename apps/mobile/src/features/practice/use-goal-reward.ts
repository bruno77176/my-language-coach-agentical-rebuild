import { useCallback, useEffect, useRef, useState } from "react";

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
    // Reset the once-fired guard when todaySeconds drops back near 0 (new day
    // or session reset). Without this, a Practice screen left mounted across
    // midnight would never fire the reward again.
    if (firedRef.current && input.todaySeconds === 0) {
      firedRef.current = false;
    }
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

  // useCallback so the reference is stable — passed into GoalReward's effect
  // deps; without this, the effect re-runs every render and starts overlapping
  // victory sounds.
  const dismiss = useCallback(() => {
    setTriggered(false);
  }, []);

  return { triggered, dismiss };
}
