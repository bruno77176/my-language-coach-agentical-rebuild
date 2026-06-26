import { describe, expect, it } from "vitest";
import { nextSchedule, masteryForBox, BOX_INTERVAL_DAYS, MAX_BOX } from "./srs";

const NOW = new Date("2026-06-26T12:00:00.000Z");
const DAY = 86_400_000;

describe("nextSchedule", () => {
  it("promotes one box on a correct answer and schedules by the new box", () => {
    const r = nextSchedule({ box: 1, correct: true, now: NOW });
    expect(r.box).toBe(2);
    // box 2 → +2 days
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + 2 * DAY);
  });

  it("drops to box 1 (due in 1 day) on a wrong answer, from any box", () => {
    for (const box of [1, 3, 6]) {
      const r = nextSchedule({ box, correct: false, now: NOW });
      expect(r.box).toBe(1);
      expect(r.dueAt.getTime()).toBe(NOW.getTime() + 1 * DAY);
    }
  });

  it("clamps at the top box and keeps the mastered interval", () => {
    const r = nextSchedule({ box: MAX_BOX, correct: true, now: NOW });
    expect(r.box).toBe(MAX_BOX);
    expect(r.dueAt.getTime()).toBe(
      NOW.getTime() + BOX_INTERVAL_DAYS[MAX_BOX]! * DAY,
    );
  });

  it("treats an out-of-range box as box 1 baseline", () => {
    const r = nextSchedule({ box: 0, correct: true, now: NOW });
    // 0 clamped up to 1, then +1 promotion → box 2
    expect(r.box).toBe(2);
  });

  it("walks the full ladder on repeated correct answers", () => {
    let box = 1;
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = nextSchedule({ box, correct: true, now: NOW });
      box = r.box;
      seen.push(box);
    }
    expect(seen).toEqual([2, 3, 4, 5, 6, 6, 6, 6]);
  });
});

describe("masteryForBox", () => {
  it("mirrors the box onto the legacy 0-3 mastery scale", () => {
    expect(masteryForBox(1)).toBe(0);
    expect(masteryForBox(2)).toBe(1);
    expect(masteryForBox(3)).toBe(2);
    expect(masteryForBox(4)).toBe(3);
    expect(masteryForBox(5)).toBe(3);
    expect(masteryForBox(6)).toBe(3);
  });
});
