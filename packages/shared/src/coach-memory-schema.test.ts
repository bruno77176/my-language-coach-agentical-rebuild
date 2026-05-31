import { describe, expect, it } from "vitest";
import {
  CoachMemorySchema,
  RecentTopicSchema,
  parseCoachMemoryRow,
} from "./coach-memory-schema";

describe("CoachMemorySchema", () => {
  it("accepts an empty memory shape", () => {
    const parsed = CoachMemorySchema.parse({
      recent_topics: [],
      weak_areas: [],
      personal_context: {},
    });
    expect(parsed.recent_topics).toEqual([]);
  });

  it("rejects unknown keys at root", () => {
    expect(() =>
      CoachMemorySchema.parse({
        recent_topics: [],
        weak_areas: [],
        personal_context: {},
        rogue: "value",
      }),
    ).toThrow();
  });

  it("caps recent_topics at 20 (extra entries dropped to last 20)", () => {
    const topics = Array.from({ length: 25 }, (_, i) => ({
      topic: `t${i}`,
      last_practiced_at: "2026-05-30T10:00:00.000Z",
    }));
    const parsed = CoachMemorySchema.parse({
      recent_topics: topics,
      weak_areas: [],
      personal_context: {},
    });
    expect(parsed.recent_topics).toHaveLength(20);
    expect(parsed.recent_topics[0]!.topic).toBe("t5"); // oldest 5 dropped
  });

  it("RecentTopicSchema requires topic + last_practiced_at", () => {
    expect(() => RecentTopicSchema.parse({ topic: "x" })).toThrow();
  });
});

describe("parseCoachMemoryRow", () => {
  it("returns null for a null/undefined row", () => {
    expect(parseCoachMemoryRow(null)).toBeNull();
    expect(parseCoachMemoryRow(undefined)).toBeNull();
  });

  it("returns a valid CoachMemory for a well-shaped row", () => {
    const parsed = parseCoachMemoryRow({
      proficiencyLevel: "B1",
      recentTopics: [
        { topic: "x", last_practiced_at: "2026-05-30T10:00:00.000Z" },
      ],
      weakAreas: ["past tense"],
      personalContext: { job: "engineer" },
      lastSessionSummary: "ok",
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.proficiency_level).toBe("B1");
    expect(parsed!.recent_topics[0]!.topic).toBe("x");
  });

  it("returns null for a row with a corrupt jsonb shape", () => {
    expect(
      parseCoachMemoryRow({
        proficiencyLevel: "X1", // invalid enum
        recentTopics: [],
        weakAreas: [],
        personalContext: {},
      }),
    ).toBeNull();
  });

  it("accepts loose timestamp strings in recent_topics (no .datetime() strictness)", () => {
    // Documents the deliberate relaxation: gpt-4o-mini often emits
    // "2026-05-30 10:00" or similar non-ISO formats. We accept them rather
    // than fail the whole memory parse on a cosmetic field.
    const parsed = parseCoachMemoryRow({
      proficiencyLevel: "B1",
      recentTopics: [{ topic: "x", last_practiced_at: "2026-05-30 10:00" }],
      weakAreas: [],
      personalContext: {},
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.recent_topics[0]!.last_practiced_at).toBe("2026-05-30 10:00");
  });
});
