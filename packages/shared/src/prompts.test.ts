import { describe, expect, it } from "vitest";
import { buildCoachSystemPrompt } from "./prompts";
import { emptyCoachMemory, type CoachMemory } from "./coach-memory-schema";

describe("buildCoachSystemPrompt", () => {
  it("works with no memory and no scenario (backwards compatible)", () => {
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
    });
    expect(out).toContain("Lisa");
    expect(out).toContain("Italian");
    expect(out).toContain("Bruno");
    expect(out).not.toContain("<context>");
    expect(out).not.toContain("<scenario>");
  });

  it("injects a <context> block when memory is provided", () => {
    const memory: CoachMemory = {
      ...emptyCoachMemory(),
      proficiency_level: "B1",
      recent_topics: [
        { topic: "trip to Italy", last_practiced_at: "2026-05-30T10:00:00.000Z" },
      ],
      last_session_summary: "Talked about food.",
    };
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
      memory,
      memoryDepth: "basic",
    });
    expect(out).toContain("<context>");
    expect(out).toContain("trip to Italy");
    expect(out).toContain("Talked about food.");
    // basic depth must NOT leak personal_context / weak_areas
    expect(out).not.toContain("personal_context");
  });

  it("includes deep memory when memoryDepth is deep", () => {
    const memory: CoachMemory = {
      ...emptyCoachMemory(),
      weak_areas: ["past tense"],
      personal_context: { job: "engineer" },
    };
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
      memory,
      memoryDepth: "deep",
    });
    expect(out).toContain("past tense");
    expect(out).toContain("engineer");
  });

  it("injects a <scenario> block when a scenario is provided", () => {
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
      scenario: {
        id: "coffee",
        systemPromptFragment:
          "You are the barista at a small Italian café. Greet the user, take their order, and introduce one twist (the espresso machine is broken).",
      },
    });
    expect(out).toContain("<scenario>");
    expect(out).toContain("barista");
  });
});
