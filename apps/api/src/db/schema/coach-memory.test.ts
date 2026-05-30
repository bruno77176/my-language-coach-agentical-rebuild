import { describe, expect, it } from "vitest";
import { coachMemory } from "./index";

describe("coach_memory schema", () => {
  it("exports the table with the expected columns", () => {
    const cols = Object.keys(coachMemory);
    for (const c of [
      "userId",
      "languageCode",
      "proficiencyLevel",
      "recentTopics",
      "weakAreas",
      "personalContext",
      "lastSessionSummary",
      "optedOut",
      "updatedAt",
    ]) {
      expect(cols).toContain(c);
    }
  });
});
