/**
 * Leitner spaced-repetition scheduling (BRU-30).
 *
 * Each vocab word sits in a box (1..6). A correct review promotes it one box
 * (a longer interval before it's next due); a wrong review drops it back to
 * box 1 (due again soon). A word is never deleted — box 6 ("mastered") still
 * resurfaces after ~60 days so it stays durable.
 *
 * This is the single source of truth for how a review changes a word's
 * schedule. Both the pronunciation route and the manual got_it/still_learning
 * route call `nextSchedule`.
 */

export const MAX_BOX = 6;

// Days until a word is next due once it lands in a given box.
export const BOX_INTERVAL_DAYS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 9,
  5: 21,
  6: 60,
};

const DAY_MS = 86_400_000;

function clampBox(box: number): number {
  if (!Number.isFinite(box) || box < 1) return 1;
  if (box > MAX_BOX) return MAX_BOX;
  return Math.floor(box);
}

export type NextScheduleInput = {
  /** The word's current box (1..6). Out-of-range values clamp to [1, 6]. */
  box: number;
  /** Whether the review was answered correctly. */
  correct: boolean;
  /** "Now" — the moment the review happened. */
  now: Date;
};

export type NextScheduleResult = {
  /** The new box (1..6). */
  box: number;
  /** When the word is next due. */
  dueAt: Date;
};

/**
 * Compute the new box + due date after a review.
 * - correct → box advances by one (capped at MAX_BOX)
 * - wrong   → box resets to 1
 * The due date is `now + interval(newBox)` days.
 */
export function nextSchedule(input: NextScheduleInput): NextScheduleResult {
  const current = clampBox(input.box);
  const box = input.correct ? Math.min(current + 1, MAX_BOX) : 1;
  const dueAt = new Date(
    input.now.getTime() + BOX_INTERVAL_DAYS[box]! * DAY_MS,
  );
  return { box, dueAt };
}

/**
 * Mirror a box onto the legacy 0..3 `mastery` scale so existing UI (the deck's
 * "mastered ✓" checkmark) keeps working without a separate concept.
 */
export function masteryForBox(box: number): number {
  return Math.min(clampBox(box) - 1, 3);
}
