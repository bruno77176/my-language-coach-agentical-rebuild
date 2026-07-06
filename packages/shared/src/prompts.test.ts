import { describe, expect, it } from "vitest";
import { buildCoachSystemPrompt, coachReplyModel } from "./prompts";
import { toProficiencyLevel } from "./proficiency";
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
        {
          topic: "trip to Italy",
          last_practiced_at: "2026-05-30T10:00:00.000Z",
        },
      ],
      // Populate deep-memory fields to verify basic depth does NOT leak them
      weak_areas: ["past tense irregulars"],
      personal_context: { job: "software engineer" },
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
    // Basic depth MUST NOT leak deep-memory values
    expect(out).not.toContain("past tense irregulars");
    expect(out).not.toContain("software engineer");
    // The literal-string check is also kept as a backstop
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

  it("fully replaces the coach persona when a scenario is provided", () => {
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
      scenario: {
        id: "coffee",
        systemPromptFragment:
          "You are the barista at a small Italian café. Greet the user, take their order, and introduce one twist (the espresso machine is broken).",
      },
    });
    // Scenario fragment IS in the prompt
    expect(out).toContain("barista");
    expect(out).toContain("Italian");
    // No Lisa-coach persona — the role person replaces it entirely. The
    // word "Lisa" still appears in the "never mention being Lisa" guard,
    // but it's never assigned as the persona's name.
    expect(out).not.toContain("Your name is Lisa");
    expect(out).not.toContain("You are a kind, patient");
    expect(out).not.toContain("Bruno"); // role person doesn't know the user's name
  });

  it("ignores memory when a scenario is active (role-played stranger has no memory of the student)", () => {
    const memory: CoachMemory = {
      ...emptyCoachMemory(),
      recent_topics: [
        {
          topic: "trip to Italy",
          last_practiced_at: "2026-05-30T10:00:00.000Z",
        },
      ],
      last_session_summary: "Talked about food.",
    };
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
      memory,
      memoryDepth: "basic",
      scenario: {
        id: "coffee",
        systemPromptFragment: "You are the barista at a small Italian café.",
      },
    });
    expect(out).not.toContain("<context>");
    expect(out).not.toContain("trip to Italy");
    expect(out).not.toContain("Talked about food.");
  });
});

describe("coach pedagogy (audit §5)", () => {
  const p = (over: Record<string, unknown> = {}) =>
    buildCoachSystemPrompt({
      targetLanguage: "de",
      userDisplayName: "Bruno",
      nativeLanguage: "fr",
      ...over,
    });

  it("carries a real correction policy (recast, not correct-every-slip)", () => {
    expect(p()).toContain("RECAST");
    expect(p().toLowerCase()).toContain("never correct every slip");
  });

  it("adds an L1 escape hatch in the learner's native language", () => {
    expect(p()).toContain("French"); // nativeLanguage "fr"
    expect(p()).toContain("clarification in French");
  });

  it("omits the L1 hatch when native == target or absent", () => {
    expect(p({ nativeLanguage: "de" })).not.toContain("clarification in");
    expect(
      buildCoachSystemPrompt({ targetLanguage: "de", userDisplayName: "B" }),
    ).not.toContain("clarification in");
  });

  it("tolerates STT errors (treats garble as mishearing)", () => {
    expect(p().toLowerCase()).toContain("misheard");
  });

  it("is honest-if-asked, not deceptive", () => {
    expect(p()).toContain("AI language coach");
    expect(p()).not.toContain("you are simply Lisa");
  });

  it("deflects unsafe/off-topic in character", () => {
    expect(p().toLowerCase()).toContain("steer back to practice");
  });

  it("reflects the learner's CEFR level when known", () => {
    expect(
      p({ memory: { ...emptyCoachMemory(), proficiency_level: "A1" } }),
    ).toContain("A1");
  });
});

describe("coachReplyModel (audit §5 AI-3)", () => {
  it("uses gpt-4o for CJK regardless of level", () => {
    expect(coachReplyModel("ja", null)).toBe("gpt-4o");
    expect(coachReplyModel("zh", "A1")).toBe("gpt-4o");
    expect(coachReplyModel("ko", undefined)).toBe("gpt-4o");
  });
  it("uses gpt-4o for B1+ learners", () => {
    expect(coachReplyModel("de", "B1")).toBe("gpt-4o");
    expect(coachReplyModel("fr", "C1")).toBe("gpt-4o");
  });
  it("uses gpt-4o-mini for A1–A2 / unknown in non-CJK", () => {
    expect(coachReplyModel("de", "A1")).toBe("gpt-4o-mini");
    expect(coachReplyModel("es", "A2")).toBe("gpt-4o-mini");
    expect(coachReplyModel("it", null)).toBe("gpt-4o-mini");
  });
});

describe("self-declared level fallback (seed-then-refine)", () => {
  it("uses the declared level when the AI hasn't inferred one", () => {
    expect(
      buildCoachSystemPrompt({
        targetLanguage: "de",
        userDisplayName: "B",
        declaredLevel: "B1",
      }),
    ).toContain("~B1");
  });

  it("prefers the AI-inferred memory level over the declared one", () => {
    const p = buildCoachSystemPrompt({
      targetLanguage: "de",
      userDisplayName: "B",
      declaredLevel: "A1",
      memory: { ...emptyCoachMemory(), proficiency_level: "B2" },
    });
    expect(p).toContain("~B2");
  });

  it("coachReplyModel respects the declared level (B1 → gpt-4o)", () => {
    expect(coachReplyModel("de", toProficiencyLevel("B1"))).toBe("gpt-4o");
  });
});

describe("toProficiencyLevel", () => {
  it("passes CEFR codes and rejects junk", () => {
    expect(toProficiencyLevel("B1")).toBe("B1");
    expect(toProficiencyLevel("C2")).toBe("C2");
    expect(toProficiencyLevel("banana")).toBeNull();
    expect(toProficiencyLevel("")).toBeNull();
    expect(toProficiencyLevel(null)).toBeNull();
    expect(toProficiencyLevel(undefined)).toBeNull();
  });
});

describe("buildCoachSystemPrompt memory items", () => {
  const base = {
    targetLanguage: "de",
    userDisplayName: "Bruno",
    memory: emptyCoachMemory(),
  };
  it("includes items in the deep tier", () => {
    const p = buildCoachSystemPrompt({
      ...base,
      memoryDepth: "deep",
      memoryItems: [{ type: "persona_detail", content: "has a dog named Rex" }],
    });
    expect(p).toContain("has a dog named Rex");
  });
  it("omits items in the basic (free) tier", () => {
    const p = buildCoachSystemPrompt({
      ...base,
      memoryDepth: "basic",
      memoryItems: [{ type: "persona_detail", content: "has a dog named Rex" }],
    });
    expect(p).not.toContain("has a dog named Rex");
  });
});

describe("buildCoachSystemPrompt lesson plan", () => {
  const base = {
    targetLanguage: "de",
    userDisplayName: "Bruno",
    memory: emptyCoachMemory(),
  };
  it("renders the lesson plan focus in the deep tier", () => {
    const p = buildCoachSystemPrompt({
      ...base,
      memoryDepth: "deep",
      lessonPlan: {
        focus: "dative prepositions",
        target_structures: ["mit + dative"],
        suggested_topics: ["cooking"],
        callbacks: ["their dog Rex"],
      },
    });
    expect(p).toContain("dative prepositions");
    expect(p).toContain("mit + dative");
    expect(p).toContain("their dog Rex");
  });
  it("omits the lesson plan in the basic (free) tier", () => {
    const p = buildCoachSystemPrompt({
      ...base,
      memoryDepth: "basic",
      lessonPlan: {
        focus: "dative prepositions",
        target_structures: ["mit + dative"],
        suggested_topics: ["cooking"],
        callbacks: ["their dog Rex"],
      },
    });
    expect(p).not.toContain("dative prepositions");
  });
  it("is backward compatible when lessonPlan is absent", () => {
    const p = buildCoachSystemPrompt({ ...base, memoryDepth: "deep" });
    expect(p).toContain("Lisa");
  });
});
