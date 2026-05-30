import { describe, expect, it } from "vitest";
import { CoachMemorySchema, RecentTopicSchema } from "./coach-memory-schema";

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
