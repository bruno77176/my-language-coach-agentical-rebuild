import { describe, expect, it } from "vitest";
import { ROLE_PLAY_SCENARIOS } from "./role-play-scenarios";

describe("ROLE_PLAY_SCENARIOS", () => {
  it("has exactly 10 scenarios", () => {
    expect(ROLE_PLAY_SCENARIOS).toHaveLength(10);
  });
  it("has exactly 3 free scenarios", () => {
    expect(ROLE_PLAY_SCENARIOS.filter((s) => !s.pro)).toHaveLength(3);
  });
  it("every scenario has a non-empty systemPromptFragment", () => {
    for (const s of ROLE_PLAY_SCENARIOS) {
      expect(s.systemPromptFragment.length).toBeGreaterThan(40);
    }
  });
  it("ids are unique", () => {
    const ids = ROLE_PLAY_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
